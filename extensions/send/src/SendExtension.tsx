import { useEffect, useState } from 'react';
import {
  reactExtension,
  useApi,
  AdminAction,
  BlockStack,
  Button,
  Text,
  Divider,
  ProgressIndicator,
} from '@shopify/ui-extensions-react/admin';

import { fetchOrdersData, OrderResponse } from '../../shared/shopifyOperations';

const TARGET = 'admin.order-index.selection-action.render';

export default reactExtension(TARGET, () => <SendExtension />);

function SendExtension() {
  const [loading, setLoading] = useState<boolean>(true);
  const [ordersContent, setOrdersContent] = useState<
    OrderResponse['nodes'] | null
  >(null);
  const { close, data } = useApi(TARGET);
  const selectedOrders = data?.selected || [];
  const selectedIds = selectedOrders.map(({ id }) => id);

  useEffect(() => {
    async function fetchOrdersContent() {
      try {
        const orders = await fetchOrdersData(selectedIds);

        console.log('🚀 ~ orders:', orders);
        setOrdersContent(orders);
      } catch (error) {
        console.error('Failed to fetch orders content:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchOrdersContent();
  }, [selectedIds]);

  return (
    <AdminAction
      primaryAction={
        <Button
          onPress={async () => {
            try {
              const response = await fetch(
                'https://novaposhta.gadget.app/sendOrdersToGoogleSheet',
                {
                  method: 'POST',
                  body: JSON.stringify(ordersContent),
                  headers: { 'Content-Type': 'application/json' },
                }
              );

              if (!response.ok) throw new Error('Failed to send data');
              alert('Orders successfully sent to Google Sheet');
            } catch (error) {
              console.error('Error sending orders:', error);
            }
          }}
          disabled={loading}
        >
          Send to Google Sheet
        </Button>
      }
    >
      <BlockStack>
        {loading ? (
          <ProgressIndicator size='small-200' />
        ) : ordersContent.length > 0 ? (
          <BlockStack>
            {ordersContent.map((order, orderIndex) => {
              const phone =
                order.shippingAddress.phone || order.phone || 'Not provided!!!';

              return (
                <BlockStack key={order.id} gap='base'>
                  <Text>
                    {order.customer.firstName} {order.customer.lastName},{' '}
                    {phone}, {order.shippingAddress?.city},{' '}
                    {order.shippingAddress?.address1}
                  </Text>
                  <Text>{order.paymentMetafield.value}</Text>
                  {order.lineItems.nodes.map((lineItem, index) => {
                    const price = parseFloat(
                      lineItem.discountedUnitPriceSet.shopMoney.amount
                    );
                    const customBarcode =
                      lineItem.customAttributes.find(
                        (attr) => attr.key === '_barcode'
                      )?.value || '';
                    const customCost = parseFloat(
                      lineItem.customAttributes.find(
                        (attr) => attr.key === '_cost'
                      )?.value || '0'
                    );

                    const cost =
                      customCost ||
                      parseFloat(
                        lineItem.variant?.inventoryItem?.unitCost.amount || '0'
                      );

                    const barcode = lineItem.variant?.barcode?.trim()
                      ? lineItem.variant.barcode
                      : customBarcode || '';

                    const delta = price - cost;
                    const title = removeBarcodeFromTitle(
                      lineItem.title,
                      lineItem.variant?.barcode
                    );

                    return (
                      <BlockStack key={index}>
                        <Text>
                          {title} {barcode ? `(${barcode.toUpperCase()})` : ''}{' '}
                          | {lineItem.unfulfilledQuantity}шт |{' '}
                          {price.toFixed(0)} | {cost.toFixed(0)} |{' '}
                          {delta.toFixed(0)}
                        </Text>
                      </BlockStack>
                    );
                  })}
                  {orderIndex < ordersContent.length - 1 && <Divider />}
                </BlockStack>
              );
            })}
          </BlockStack>
        ) : (
          <Text>No orders content available</Text>
        )}
      </BlockStack>
    </AdminAction>
  );
}

function removeBarcodeFromTitle(
  title: string,
  barcode?: string | null
): string {
  if (!barcode) {
    return title;
  }

  const regex = new RegExp(barcode, 'ig');
  title = title.replace(/[\(\)]/g, '').trim();
  return title.replace(regex, '').trim().slice(0, 40);
}
