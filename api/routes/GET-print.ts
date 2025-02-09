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

const route: RouteHandler<{
  Querystring: UrlParams;
}> = async ({ request, reply, connections }) => {
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
                lineItems(first: 20) {
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

    const variables = { ids };

    const response = await shopify.graphql(query, variables);

    const orders = response.nodes;
    console.log(orders[0].lineItems);
    console.log(orders[0].lineItems.nodes[0].product);
    if (!orders?.length) {
      console.log('No orders found in response');
      return reply.status(404).send({ error: 'No orders found' });
    }

    console.log(`Found ${orders.length} orders`);
    const pages = orders.map((order: OrderResponse['nodes'][0]) =>
      orderPage('invoice', order)
    );
    const print = printHTML(pages);

    return reply.type('text/html').send(print);
  } catch (error) {
    console.error('Error details:', error);
    return reply.status(500).send({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

function orderPage(docType: string, order: OrderResponse['nodes'][0]): string {
  const customer = `${order.customer.firstName} ${order.customer.lastName}`;
  const address = `${order.shippingAddress.city}, ${order.shippingAddress.address1}`;
  const phone = order.shippingAddress.phone || order.phone;
  const paymentMethod = order.paymentMetafield?.value || 'Не вказано';

  let totalPrice = 0;
  let totalDelta = 0;
  let totalCost = 0;

  const lineItems = order.lineItems.nodes
    .map((item) => {
      try {
        const price = parseFloat(item.discountedUnitPriceSet.shopMoney.amount);
        const delta = parseFloat(item.product?.deltaMetafield?.value || '0');
        const cost = price - delta;

        // Add to totals
        totalPrice += price * item.quantity;
        totalDelta += delta * item.quantity;
        totalCost += cost * item.quantity;

        return `
          <tr>
            <td>${item.variant?.sku || 'N/A'}</td>
            <td>${item.title}</td>
            <td>${(item.variant?.barcode || 'N/A').toUpperCase()}</td>
            <td>${item.quantity}</td>
            <td>${price.toFixed(0)}</td>
            <td>${cost.toFixed(0)}</td>
            <td>${delta.toFixed(0)}</td>
          </tr>
        `;
      } catch (error) {
        console.error('Error processing line item:', error, item);
        return `
          <tr>
            <td colspan="7" style="color: red;">Error processing item: ${item.title}</td>
          </tr>
        `;
      }
    })
    .join('');

  return `<main>
      <div class="order-details">
        <h1>${order.name}</h1>
        <div class="customer-info">
          <p> ${customer}, ${phone}</p>
          <p> ${address}</p>
          <p> ${paymentMethod}</p>
        </div>
        <table class="items">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Title</th>
              <th>Barcode</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Cost</th>
              <th>Delta</th>
            </tr>
          </thead>
          <tbody>
            ${lineItems}
            ${
              order.lineItems.nodes.length > 1
                ? `
                <tr class="totals">
                  <td colspan="3"><strong>Totals:</strong></td>
                  <td></td>
                  <td><strong>${totalPrice.toFixed(0)}</strong></td>
                  <td><strong>${totalCost.toFixed(0)}</strong></td>
                  <td><strong>${totalDelta.toFixed(0)}</strong></td>
            </tr>`
                : ''
            }
          </tbody>
        </table>
      </div>
    </main>`;
}

function printHTML(pages: string[]): string {
  return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <title>Order Print</title>
      <style>
        body { font-family: Arial, sans-serif; }
        .order-container { margin: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .customer-info { margin: 20px 0; }
        .order-details { padding: 20px; border-bottom: 2px solid #000; margin-bottom: 20px; }
        .totals td { background-color: #f9f9f9; }
        .totals td:first-child { text-align: right; }
      </style>
    </head>
    <body>
      <div class="order-container">
        ${pages.join('')}
      </div>
    </body>
    </html>`;
}

export default route;
