import { RouteHandler } from 'gadget-server';
import { getShopifyClient, getUrlParams, UrlParams } from 'utilities';

interface OrderResponse {
  nodes: {
    id: string;
    name: string;
    createdAt: string;
    phone: string;
    customer: {
      firstName: string;
      lastName: string;
    };
    shippingAddress: {
      phone: string;
      city: string;
      address1: string;
    };
    lineItems: {
      nodes: {
        title: string;
        quantity: number;
        discountedUnitPriceSet: {
          shopMoney: {
            amount: string;
          };
        };
        variant: {
          sku: string;
          barcode: string;
        };
        product: {
          deltaMetafield: {
            value: string;
          } | null;
        };
      }[];
    };
    paymentMetafield: {
      value: string;
    } | null;
  }[];
}

const route: RouteHandler<{ Querystring: UrlParams }> = async ({
  request,
  reply,
  connections,
}) => {
  try {
    const shopify = getShopifyClient(connections);
    const { orderIds } = getUrlParams(request);
    if (!orderIds) {
      return reply.status(400).send({ error: 'Missing orderIds parameter' });
    }

    const ids = orderIds.split(',').map((id) => id);
    if (!ids.length) {
      return reply.status(400).send({ error: 'Invalid orderIds parameter' });
    }

    const query = `query GetOrdersByIds($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Order {
          id
          name
          createdAt
          phone
          customer {
            firstName
            lastName
          }
          shippingAddress {
            phone
            city
            address1
          }
          lineItems(first: 10) {
            nodes {
              title
              quantity
              discountedUnitPriceSet {
                shopMoney {
                  amount
                }
              }
              variant {
                sku
                barcode
              }
              product {
                deltaMetafield: metafield(namespace: "custom", key: "delta") {
                  value
                }
              }
            }
          }
          paymentMetafield: metafield(namespace: "custom", key: "payment_method") {
            value
          }
        }
      }
    }`;

    const response = await shopify.graphql(query, { ids });
    const orders = response.nodes;
    if (!orders?.length) {
      return reply.status(404).send({ error: 'No orders found' });
    }

    const print = generateHtml(orders);

    return reply.type('text/html').send(print);
  } catch (error) {
    console.error('Error details:', error);
    return reply.status(500).send({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

function generateHtml(orders: OrderResponse['nodes']): string {
  let html = `
      <html>
        <head>
          <style>
            body { font-family: monospace; font-size: 14px; }
            pre { white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <pre>`;

  for (const order of orders) {
    const customer = `${order.customer.firstName} ${order.customer.lastName}`;
    const address = `${order.shippingAddress.city}, ${order.shippingAddress.address1}`;
    const phone = order.shippingAddress.phone || order.phone;
    const paymentMethod = order.paymentMetafield?.value || 'Не вказано';

    let totalPrice = 0;
    let totalDelta = 0;
    let totalCost = 0;

    order.lineItems.nodes.forEach((item) => {
      try {
        const price = parseFloat(item.discountedUnitPriceSet.shopMoney.amount);
        const delta = parseFloat(item.product?.deltaMetafield?.value || '0');
        const cost = price - delta;

        totalPrice += price * item.quantity;
        totalDelta += delta * item.quantity;
        totalCost += cost * item.quantity;

        const barcode = item.variant?.barcode ? item.variant.barcode : '';
        const titleLowerCase = item.title.toLowerCase();

        const titleWithBarcode = titleLowerCase.includes(barcode.toLowerCase())
          ? ''
          : barcode.toUpperCase();

        html += `\n${item.title.slice(0, 40)} ${titleWithBarcode} | ${String(
          item.quantity
        )}шт | ${String(price.toFixed(0))} | ${String(
          cost.toFixed(0)
        )} | ${String(delta.toFixed(0))}`;
      } catch (error) {
        console.error('Error processing line item:', error, item);
        html += `\nError processing item: ${item.title}`;
      }
    });
    html +=
      order.lineItems.nodes.length > 1
        ? `\nTOTALS: ${String(totalPrice.toFixed(0))} | ${String(
            totalCost.toFixed(0)
          )} | ${String(totalDelta.toFixed(0))}`
        : '';

    html += `
          ${customer}, ${phone}
          ${address}
          ${paymentMethod} ${String(totalPrice.toFixed(0))}грн`;

    html += '\n=====================';
  }

  html += `</pre>
        </body>
      </html>`;

  return html;
}

export default route;
