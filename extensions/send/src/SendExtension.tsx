import { useEffect, useState, useMemo } from 'react';
import {
  reactExtension,
  useApi,
  AdminAction,
  BlockStack,
  Button,
  Text,
  ProgressIndicator,
} from '@shopify/ui-extensions-react/admin';

import {
  fetchOrdersData,
  OrderResponse,
  updateOrdersTags,
  addOrderNote,
} from '../../shared/shopifyOperations';
import { SHOPIFY_APP_URL } from '../../shared/data';

const TARGET = 'admin.order-index.selection-action.render';

export default reactExtension(TARGET, () => <SendExtension />);

function SendExtension() {
  const [loading, setLoading] = useState<boolean>(true);
  const [sent, setSent] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [ordersContent, setOrdersContent] = useState<
    OrderResponse['nodes'] | null
  >(null);
  const { data } = useApi(TARGET);
  const selectedOrders = data?.selected || [];
  const selectedIds = useMemo(
    () => selectedOrders.map(({ id }: { id: string }) => id),
    [selectedOrders]
  );

  const emailWarrantyCards = async (ordersContent: OrderResponse['nodes']) => {
    try {
      const response = await fetch(`${SHOPIFY_APP_URL}/emailWarrantyCards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: 'Order Details',
          ordersContent,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Email sent successfully:', result);
    } catch (error) {
      console.error('Failed to send email:', error);
    }
  };

  useEffect(() => {
    console.log('Fetching orders for:', selectedIds);
    async function fetchOrdersContent() {
      try {
        const orders = await fetchOrdersData(selectedIds);

        setOrdersContent(orders);
        setError(null);
      } catch (error) {
        console.error('Failed to fetch orders content:', error);
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to fetch orders';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    }
    fetchOrdersContent();
  }, [selectedIds]);
  const firstOrderTag = ordersContent?.[0]?.tags?.[0] || '';

  let spreadsheetId = '';
  let sheetName = 'Sheet2';
  let recipientEmail = '';
  let shouldSendWarrantyEmail = false;
  let shouldAutoTag = false;
  let shouldSendEmail = false;
  let tagStrategy:
    | string
    | ((order: OrderResponse['nodes'][number]) => string) = COMPLETED_TAG;

  if (firstOrderTag.includes('Ии')) {
    // Easy supplier
    spreadsheetId = '1DIDI_GIIehGNRADrOCZXOlPwyXvh4hkHSKkO79GaIIM';
    recipientEmail = 'deni-ua@ukr.net';
    shouldAutoTag = true;
    shouldSendEmail = true;
    tagStrategy = getEasySupplierTag;
  } else if (firstOrderTag.includes('РІ')) {
    // Rozetka supplier
    spreadsheetId = '1Tb8YTGBhAONP0QXrsCohbsNF3TEN58zXQ785l20o7Ic';
    recipientEmail = 'asd1134@ukr.net';
    shouldAutoTag = true;
    shouldSendEmail = true;
    tagStrategy = COMPLETED_TAG;
  } else if (firstOrderTag.includes('Че')) {
    // Schusev supplier
    spreadsheetId = '17J3L12ZHz3VoYp2la5dTcCmZg4-zcNZpCUyvifgLZkk';
    recipientEmail = 'scherginets@ukr.net';
    shouldAutoTag = true;
    shouldSendWarrantyEmail = true;
    shouldSendEmail = true;
    tagStrategy = COMPLETED_TAG;
  } else if (firstOrderTag.includes('Ме')) {
    // Unknown supplier
    spreadsheetId = '1jHwJA0U9XXSu1W66P7WOSuNiCMLvdMtXyTnPOOVQLP4';
    sheetName = 'Sheet1';
    shouldAutoTag = true;
    tagStrategy = COMPLETED_TAG;
  }

  const getTitle = () => {
    if (error) return error;
    if (loading) return 'Loading orders...';
    if (sent) return `Orders sent (${selectedIds.length} processed)`;

    const baseTitle = firstOrderTag
      ? `Send "${firstOrderTag}" orders`
      : 'Send orders';

    return `${baseTitle} (${selectedIds.length} selected)`;
  };

  return (
    <AdminAction
      title={getTitle()}
      primaryAction={
        <Button
          onPress={async () => {
            setError(null);
            try {
              const rows = convertOrdersToRows(ordersContent!);

              const appendResponse = await fetch(
                `${SHOPIFY_APP_URL}/appendRowsToSheet`,
                {
                  method: 'POST',
                  body: JSON.stringify({ rows, spreadsheetId, sheetName }),
                  headers: { 'Content-Type': 'application/json' },
                }
              );
              if (!appendResponse.ok) throw new Error('Failed to send data');

              if (shouldSendEmail) {
                const emailResponse = await fetch(
                  `${SHOPIFY_APP_URL}/send-email`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      recipientEmail,
                      cc: 'nezhihai@gmail.com',
                      subject:
                        'Замовлення, кількість: ' + ordersContent!.length,
                      htmlContent: generateOrdersHtmlTable(ordersContent!),
                    }),
                  }
                );
                if (!emailResponse.ok) throw new Error('Failed to send email');
                if (shouldSendWarrantyEmail) emailWarrantyCards(ordersContent!);
              }

              // Auto-tag processed orders
              if (shouldAutoTag) {
                try {
                  await autoTagProcessedOrders(ordersContent!, tagStrategy);
                } catch (tagError) {
                  console.error('Failed to auto-tag orders:', tagError);
                }
              }

              setSent(true);
            } catch (error) {
              console.error('Error sending orders:', error);
              const errorMessage =
                error instanceof Error
                  ? error.message
                  : 'Failed to send orders';
              setError(errorMessage);
            }
          }}
          disabled={loading || !ordersContent || sent}
        >
          {sent ? 'Added' : 'Add to Google Sheet'}
        </Button>
      }
    >
      <BlockStack>
        {loading ? (
          <ProgressIndicator size='small-200' />
        ) : ordersContent && ordersContent.length > 0 ? (
          <BlockStack>
            {ordersContent.map((order, orderIndex) => (
              <OrderDetails
                key={order.id}
                order={order}
                orderIndex={orderIndex}
                ordersContent={ordersContent}
              />
            ))}
          </BlockStack>
        ) : (
          <Text>No orders content available</Text>
        )}
      </BlockStack>
    </AdminAction>
  );
}

type OrderDetailsProps = {
  order: OrderResponse['nodes'][number];
  orderIndex: number;
  ordersContent: OrderResponse['nodes'];
};

function OrderDetails({ order, orderIndex, ordersContent }: OrderDetailsProps) {
  const phone = getOrderPhone(order);
  const totalSum = order.lineItems.nodes.reduce((sum, lineItem) => {
    const price = parseFloat(lineItem.discountedUnitPriceSet.shopMoney.amount);
    return sum + price * lineItem.unfulfilledQuantity;
  }, 0);

  return (
    <BlockStack gap='base'>
      <Text>
        {order.paymentMetafield?.value}: {totalSum.toFixed(0)}
      </Text>
      {order.lineItems.nodes.map((lineItem, index) => {
        const { barcode, cost } = getBarcodeAndCost(lineItem);
        const price = parseFloat(
          lineItem.discountedUnitPriceSet.shopMoney.amount
        );
        const delta = lineItem.unfulfilledQuantity * (price - cost) || 0;
        const title = removeBarcodeFromTitle(
          lineItem.title,
          lineItem.variant?.barcode
        );

        return (
          <BlockStack key={index}>
            <Text>
              {formatOrderDetails(
                title,
                barcode,
                lineItem.unfulfilledQuantity,
                price,
                cost,
                delta
              )}
            </Text>
          </BlockStack>
        );
      })}
      <Text>
        т. {phone},{' '}
        {order.shippingAddress?.firstName || order.customer.firstName}{' '}
        {order.shippingAddress?.lastName || order.customer.lastName},
        {order.shippingAddress?.city}, {order.shippingAddress?.address1}
      </Text>

      {orderIndex < ordersContent.length - 1 && <Text>_________</Text>}
    </BlockStack>
  );
}

function getOrderPhone(order: OrderResponse['nodes'][number]): string {
  return order.shippingAddress.phone || order.phone || '!!!!! Error';
}

type LineItem = OrderResponse['nodes'][number]['lineItems']['nodes'][number];

function getBarcodeAndCost(lineItem: LineItem) {
  const customBarcode =
    lineItem.customAttributes.find((attr) => attr.key === '_barcode')?.value ||
    '';
  const customCost = parseFloat(
    lineItem.customAttributes.find((attr) => attr.key === '_cost')?.value || '0'
  );
  const cost =
    customCost ||
    parseFloat(lineItem.variant?.inventoryItem?.unitCost?.amount || '0');
  const barcode = (
    lineItem.variant?.barcode?.trim()
      ? lineItem.variant.barcode
      : customBarcode || ''
  ).toUpperCase();

  return { barcode, cost };
}

function formatOrderDetails(
  title: string,
  barcode: string,
  quantity: number,
  price: number,
  cost: number,
  delta: number
) {
  return `${title} ${
    barcode ? `(${barcode.toUpperCase()})` : ''
  } | ${quantity}шт | ${price.toFixed(0)} `;
  //  return `${title} ${
  //    barcode ? `(${barcode.toUpperCase()})` : ''
  //  } | ${quantity}шт | ${price.toFixed(0)} | ${cost.toFixed(
  //    0
  //  )} | ${delta.toFixed(0)}`;
}

function removeBarcodeFromTitle(
  title: string,
  barcode?: string | null
): string {
  if (!barcode) return title;
  const regex = new RegExp(barcode, 'ig');
  return title
    .replace(/\(\)/g, '')
    .trim()
    .replace(regex, '')
    .trim()
    .slice(0, 40);
}

function convertOrdersToRows(orders: OrderResponse['nodes']) {
  return orders
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((order) => {
      const currentDate = new Date().toISOString().split('T')[0];
      return order.lineItems.nodes.map((lineItem, index) => {
        const { barcode, cost } = getBarcodeAndCost(lineItem);
        const price = parseFloat(
          lineItem.discountedUnitPriceSet.shopMoney.amount
        );
        const delta = lineItem.unfulfilledQuantity * (price - cost);
        const title = removeBarcodeFromTitle(lineItem.title, barcode);

        return [
          currentDate,
          order.name,
          index === 0 ? getOrderPhone(order) : '',
          index === 0
            ? order.shippingAddress?.firstName || order.customer.firstName
            : '',
          index === 0
            ? order.shippingAddress?.lastName || order.customer.lastName
            : '',
          index === 0 ? order.shippingAddress.city : '',
          index === 0 ? order.shippingAddress.address1 : '',
          title,
          barcode,
          lineItem.unfulfilledQuantity,
          price.toFixed(0),
          cost.toFixed(0),
          delta.toFixed(0),
          index === 0 ? order.paymentMetafield?.value || '' : '',
        ];
      });
    });
}

function generateOrdersHtmlTable(orders: OrderResponse['nodes']) {
  if (!orders || orders.length === 0) return '<p>No orders.</p>';

  const rows = orders
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((order) => {
      return order.lineItems.nodes.map((lineItem, index) => {
        const { barcode, cost } = getBarcodeAndCost(lineItem);
        const price = parseFloat(
          lineItem.discountedUnitPriceSet.shopMoney.amount
        );
        const delta = lineItem.unfulfilledQuantity * (price - cost);
        return {
          phone: index === 0 ? getOrderPhone(order) : '',
          firstName:
            index === 0
              ? order.shippingAddress?.firstName || order.customer.firstName
              : '',
          lastName:
            index === 0
              ? order.shippingAddress?.lastName || order.customer.lastName
              : '',
          city: index === 0 ? order.shippingAddress?.city : '',
          address: index === 0 ? order.shippingAddress?.address1 : '',
          title: removeBarcodeFromTitle(
            lineItem.title,
            lineItem.variant?.barcode
          ),
          barcode,
          quantity: lineItem.unfulfilledQuantity,
          price: price.toFixed(0),
          cost: cost.toFixed(0),
          delta: delta.toFixed(0),
          payment: index === 0 ? order.paymentMetafield?.value || '' : '',
        };
      });
    });

  const header = [
    'Phone',
    'First Name',
    'Last Name',
    'City',
    'Address',
    'Product',
    'Barcode',
    'Qty',
    'Price',
    'Cost',
    'Delta',
    'Payment',
  ];

  // Create a mapping from header names to object properties
  const keyMap: { [key: string]: string } = {
    Phone: 'phone',
    'First Name': 'firstName',
    'Last Name': 'lastName',
    City: 'city',
    Address: 'address',
    Product: 'title',
    Barcode: 'barcode',
    Qty: 'quantity',
    Price: 'price',
    Cost: 'cost',
    Delta: 'delta',
    Payment: 'payment',
  };

  const thead = `<thead><tr>${header
    .map((h) => `<th>${h}</th>`)
    .join('')}</tr></thead>`;
  const tbody = `<tbody>${rows
    .map(
      (row) =>
        `<tr>${header
          .map((key) => `<td>${(row as any)[keyMap[key]] ?? ''}</td>`)
          .join('')}</tr>`
    )
    .join('')}</tbody>`;

  return `<table border="1" cellpadding="4" cellspacing="0">${thead}${tbody}</table>`;
}

// Tag strategies
const COMPLETED_TAG = 'Завершені';

function getEasySupplierTag(order: OrderResponse['nodes'][number]): string {
  const matchesPattern = /^№\d{9}$/.test(order.name);
  return matchesPattern ? 'Декларації' : 'Завершені';
}

// Reusable auto-tagging function
async function autoTagProcessedOrders(
  orders: OrderResponse['nodes'],
  tagStrategy: string | ((order: OrderResponse['nodes'][number]) => string)
): Promise<void> {
  for (const order of orders) {
    const newTag =
      typeof tagStrategy === 'function' ? tagStrategy(order) : tagStrategy;

    console.log(`Auto-tagging order ${order.name} with: ${newTag}`);

    await updateOrdersTags({
      value: newTag,
      orderIds: [order.id],
    });

    try {
      await addOrderNote({
        orderId: order.id,
        note: `Order sent to supplier. Tagged as: ${newTag}`,
      });
    } catch (error) {
      console.error(`Failed to add note to order ${order.name}:`, error);
      // Don't throw - continue processing other orders
    }
  }
}
