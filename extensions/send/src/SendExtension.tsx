import { useEffect, useState, useCallback } from 'react';
import {
  reactExtension,
  useApi,
  AdminAction,
  BlockStack,
  Button,
  Text,
  ProgressIndicator,
} from '@shopify/ui-extensions-react/admin';

import { fetchOrdersData, OrderResponse } from '../../shared/shopifyOperations';

const TARGET = 'admin.order-index.selection-action.render';
const SPREADSHEET_ID = '1DIDI_GIIehGNRADrOCZXOlPwyXvh4hkHSKkO79GaIIM';

export default reactExtension(TARGET, () => <SendExtension />);

function SendExtension() {
  const [loading, setLoading] = useState<boolean>(true);
  const [sent, setSent] = useState<boolean>(false);
  const [ordersContent, setOrdersContent] = useState<
    OrderResponse['nodes'] | null
  >(null);
  const { data } = useApi(TARGET);
  const selectedOrders = data?.selected || [];
  const selectedIds = selectedOrders.map(({ id }: { id: string }) => id);

  const handleSendFormattedEmail = async (
    ordersContent: OrderResponse['nodes']
  ) => {
    try {
      const htmlContent = formatOrdersContentToWarrantyHtml(ordersContent);
      const response = await fetch(
        'https://novaposhta.gadget.app/sendFormattedEmail',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            subject: 'Order Details',
            html: htmlContent,
          }),
        }
      );

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
              const rows = convertOrdersToRows(ordersContent!);
              const response = await fetch(
                'https://novaposhta.gadget.app/appendRowsToSheet',
                {
                  method: 'POST',
                  body: JSON.stringify({ rows, spreadsheetId: SPREADSHEET_ID }),
                  headers: { 'Content-Type': 'application/json' },
                }
              );
              if (!response.ok) throw new Error('Failed to send data');

              setSent(true);
            } catch (error) {
              console.error('Error sending orders:', error);
            }
          }}
          disabled={loading || !ordersContent || sent}
        >
          {sent ? 'Sent' : 'Send to Google Sheet'}
        </Button>
      }
      secondaryAction={
        <Button
          onPress={() => handleSendFormattedEmail(ordersContent!)}
          disabled={loading || !ordersContent}
        >
          Send Email
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
      {order.lineItems.nodes.map((lineItem, index) => {
        const { barcode, cost } = getBarcodeAndCost(lineItem);
        const price = parseFloat(
          lineItem.discountedUnitPriceSet.shopMoney.amount
        );
        const delta = price - cost;
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
        {phone}, {order.customer.firstName} {order.customer.lastName},
        {order.shippingAddress?.city}, {order.shippingAddress?.address1}
      </Text>
      <Text>
        {order.paymentMetafield?.value}: {totalSum.toFixed(0)}
      </Text>
      {orderIndex < ordersContent.length - 1 && <Text>_________</Text>}
    </BlockStack>
  );
}

function getOrderPhone(order: OrderResponse['nodes'][number]): string {
  return order.shippingAddress.phone || order.phone || 'Not provided';
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
  const barcode = lineItem.variant?.barcode?.trim()
    ? lineItem.variant.barcode
    : customBarcode || '';

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
  } | ${quantity}шт | ${price.toFixed(0)} | ${cost.toFixed(
    0
  )} | ${delta.toFixed(0)}`;
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
  return orders.flatMap((order) =>
    order.lineItems.nodes.map((lineItem) => {
      const { barcode, cost } = getBarcodeAndCost(lineItem);
      const price = parseFloat(
        lineItem.discountedUnitPriceSet.shopMoney.amount
      );
      const delta = price - cost;
      const currentDate = new Date().toISOString().split('T')[0];

      return [
        currentDate,
        order.name,
        getOrderPhone(order),
        order.customer.firstName,
        order.customer.lastName,
        order.shippingAddress.city,
        order.shippingAddress.address1,
        lineItem.title,
        barcode,
        lineItem.unfulfilledQuantity,
        price.toFixed(0),
        cost.toFixed(0),
        delta.toFixed(0),
        order.paymentMetafield?.value || '',
      ];
    })
  );
}

function formatOrdersContentToWarrantyHtml(
  orders: OrderResponse['nodes']
): string {
  const rows = orders
    .map((order) => {
      const lineItemsHtml = order.lineItems.nodes
        .map((lineItem) => {
          const { barcode } = getBarcodeAndCost(lineItem);
          const title = removeBarcodeFromTitle(
            lineItem.title,
            lineItem.variant?.barcode
          );

          return `
                <tr>
                    <td>${title}</td>
                    <td>${barcode}</td>
                    <td>${lineItem.unfulfilledQuantity}</td>
                </tr>
            `;
        })
        .join('');

      return `
            <div class="warranty-document">
                <img src="https://cdn.shopify.com/s/files/1/0868/0462/7772/files/informatica-logo-good1.jpg?v=1740226141" alt="Logo" class="logo" />
                <h3>Warranty Document for Order: ${order.name}</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>Barcode</th>
                            <th>Quantity</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${lineItemsHtml}
                    </tbody>
                </table>
                <p>This document serves as a warranty for the items listed above. Please keep it for your records.</p>
            </div>
            <hr />
        `;
    })
    .join('');

  return `
        <html>
            <head>
                <style>
                    @media print {
                        @page { margin: 0; }
                        body { margin: 0; }
                        .email-header { display: none; }
                    }
                    body {
                        font-family: Arial, sans-serif;
                        margin: 0;
                        padding: 20px;
                    }
                    .warranty-document {
                        page-break-after: always;
                    }
                    .logo {
                        width: 150px;
                        float: left;

                    }
                    h3 {
                        clear: both;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 20px;
                    }
                    table, th, td {
                        border: 1px solid black;
                    }
                    th, td {
                        padding: 8px;
                        text-align: left;
                    }
                    hr {
                        border: 0;
                        border-top: 1px solid #ccc;
                        margin: 40px 0;
                    }
                </style>
            </head>
            <body>
                ${rows}
            </body>
        </html>
    `;
}
