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
        unfulfilledQuantity: number;
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
        customAttributes: {
          key: string;
          value: string;
        }[];
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
              unfulfilledQuantity
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
              customAttributes {
                key
                value
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
  const styles = `
      <style>
        body { font-family: monospace; font-size: 14px; }
        pre { white-space: pre-wrap; }
      </style>`;

  let html = `<html><head>${styles}</head><body><pre>`;

  for (const order of orders) {
    const orderDetails = formatOrderDetails(order);
    html += orderDetails;
  }

  html += `</pre></body></html>`;
  return html;
}

function formatOrderDetails(order: OrderResponse['nodes'][number]): string {
  const customer = `${order.customer?.firstName || ''} ${
    order.customer?.lastName || ''
  }`.trim();
  const address = `${order.shippingAddress.city}, ${order.shippingAddress.address1}`;
  const phone = order.shippingAddress.phone || order.phone;
  const paymentMethod = order.paymentMetafield?.value || 'Не вказано';

  let totalPrice = 0,
    totalDelta = 0,
    totalCost = 0;
  let lineItemsText = '';
  const items = order.lineItems.nodes.filter(
    (item) => item.unfulfilledQuantity > 0
  );

  for (const item of items) {
    const itemText = formatLineItem(item);
    if (itemText) {
      lineItemsText += itemText.text;
      totalPrice += itemText.totalPrice;
      totalDelta += itemText.totalDelta;
      totalCost += itemText.totalCost;
    }
  }

  const totalsText =
    items.length > 1
      ? `Загалом: ${totalPrice.toFixed(0)} | ${totalCost.toFixed(
          0
        )} | ${totalDelta.toFixed(0)}`
      : '';

  let result = `${lineItemsText}`;

  if (totalsText) {
    result += `\n${totalsText}`;
  }

  result += `
        ${paymentMethod} ${totalPrice.toFixed(0)}грн
        т. ${phone}; ${customer}; ${address}
        __________________`;

  return result;
}

function formatLineItem(
  item: OrderResponse['nodes'][number]['lineItems']['nodes'][number]
) {
  try {
    console.log('item=', JSON.stringify(item, null, 2));

    const quantity = item.unfulfilledQuantity;
    const price = parseFloat(item.discountedUnitPriceSet.shopMoney.amount);

    const customBarcode =
      item.customAttributes.find((attr) => attr.key === '_barcode')?.value ||
      '';
    const customCost = parseFloat(
      item.customAttributes.find((attr) => attr.key === '_cost')?.value || '0'
    );

    const barcode = item.variant?.barcode?.trim()
      ? item.variant.barcode
      : customBarcode;

    const delta = item.product?.deltaMetafield?.value
      ? parseFloat(item.product.deltaMetafield.value)
      : price - customCost;

    const cost = price - delta;
    const totalLineDelta = delta * quantity;

    const shortTitle = sliceWithEllipsis(item.title, 70);
    const processedBarcode = shortTitle
      .toLowerCase()
      .includes(barcode.toLowerCase())
      ? ''
      : barcode.toUpperCase();

    return {
      text: `\n${shortTitle} ${processedBarcode} | ${quantity}шт | ${price.toFixed(
        0
      )} | ${cost.toFixed(0)} | ${totalLineDelta.toFixed(0)}`,
      totalPrice: price * quantity,
      totalDelta: totalLineDelta,
      totalCost: cost * quantity,
    };
  } catch (error) {
    console.error('Error processing line item:', error, item);
    return {
      text: `\nError processing item: ${item.title}`,
      totalPrice: 0,
      totalDelta: 0,
      totalCost: 0,
    };
  }
}

function sliceWithEllipsis(title: string, maxLength: number) {
  let shortTitle = title.slice(0, maxLength);
  return title.length > shortTitle.length ? shortTitle + '...' : title;
}

export default route;
