import { RouteHandler } from 'gadget-server';
import { getShopifyClient, getUrlParams, UrlParams } from 'utilities';

interface OrderResponse {
  order: {
    name: string;
    createdAt: string;
    totalPriceSet: {
      shopMoney: {
        amount: string;
      };
    };
    lineItems: {
      edges: {
        node: {
          title: string;
          quantity: number;
        };
      }[];
    };
  } | null;
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

    const ids = orderIds.split(',');
    if (!ids.length) {
      return reply.status(400).send({ error: 'Invalid orderIds parameter' });
    }

    const orders: OrderResponse['order'][] = [];
    for (const orderId of ids) {
      const query = `
        query getOrder($orderId: ID!) {
          order(id: $orderId) {
            name
            createdAt
            totalPriceSet {
              shopMoney {
                amount
              }
            }
            lineItems(first: 10) {
              edges {
                node {
                  title
                  quantity

                }
              }
            }
          }
        }
      `;

      const response: OrderResponse = await shopify.graphql(query, { orderId });
      if (response.order) {
        orders.push(response.order);
      }
    }

    if (!orders.length) {
      return reply.status(404).send({ error: 'No orders found' });
    }

    const pages = orders.flatMap((order) => orderPage('invoice', order));
    const print = printHTML(pages);

    return reply.type('text/html').send(print);
  } catch (error) {
    return reply.status(500).send({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

function orderPage(docType: string, order: OrderResponse['order']): string {
  if (!order) return '';
  const price = order.totalPriceSet.shopMoney.amount;
  const name = order.name;
  const createdAt = order.createdAt.split('T')[0];

  const lineItems = order.lineItems.edges
    .map(({ node }) => `<p>${node.quantity}x ${node.title}</p>`)
    .join('');

  return `<main>
      <div>
        <h1>${docType}</h1>
        <p>Order ${name} - ${createdAt}</p>
        <p>Order total: $${price}</p>
        ${lineItems}

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
    </style>
  </head>
  <body>
    ${pages.join('<hr>')}
  </body>
  </html>`;
}

export default route;
