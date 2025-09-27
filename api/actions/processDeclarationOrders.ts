import { fetchNovaPoshtaDeclaration } from '../utilities/fetchDeclarationFromSheet';

interface Order {
  id: string;
  name: string;
  fulfillmentStatus: string;
  tags: string;
  shopId: string;
}

interface FulfillmentOrderEdge {
  node: {
    id: string;
    status: string;
  };
}

// Validate order before processing
const validateOrder = (order: Order): boolean => {
  return !!order.name;
};

// Get fulfillment orders for a given order
const getFulfillmentOrders = async (
  shopifyClient: any,
  orderId: string
): Promise<FulfillmentOrderEdge[]> => {
  const fulfillmentOrdersResponse = await shopifyClient.graphql(
    `
    query GetOrderFulfillmentOrders($orderId: ID!) {
      order(id: $orderId) {
        id
        name
        fulfillmentOrders(first: 10) {
          edges {
            node {
              id
              status
            }
          }
        }
      }
    }
  `,
    {
      orderId: `gid://shopify/Order/${orderId}`,
    }
  );

  return fulfillmentOrdersResponse.order?.fulfillmentOrders?.edges || [];
};

// Create fulfillment for a fulfillment order
const createFulfillment = async (
  shopifyClient: any,
  fulfillmentOrderId: string,
  trackingNumber: string,
  orderName: string
): Promise<void> => {
  const fulfillmentResponse = await shopifyClient.graphql(
    `
    mutation FulfillOrder($fulfillment: FulfillmentInput!, $message: String) {
      fulfillmentCreate(
        fulfillment: $fulfillment
        message: $message
      ) {
        fulfillment {
          id
          status
          createdAt
          totalQuantity
          trackingInfo {
            number
            url
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `,
    {
      fulfillment: {
        trackingInfo: {
          number: trackingNumber,
          url: `https://novaposhta.ua/tracking/${trackingNumber}`,
          company: 'Nova Poshta',
        },
        lineItemsByFulfillmentOrder: [
          {
            fulfillmentOrderId: fulfillmentOrderId,
          },
        ],
      },
      message: 'Order fulfilled via Nova Poshta declaration processing',
    }
  );

  if (fulfillmentResponse.fulfillmentCreate.userErrors?.length > 0) {
    console.error(
      `Fulfillment creation errors for order ${orderName}:`,
      fulfillmentResponse.fulfillmentCreate.userErrors
    );
  }
};

// Process fulfillment for an order with declaration
const processFulfillment = async (
  connections: any,
  order: Order,
  declaration: string
): Promise<void> => {
  const shopifyClient = await connections.shopify.forShopId(order.shopId);
  const fulfillmentOrders = await getFulfillmentOrders(shopifyClient, order.id);

  if (fulfillmentOrders.length === 0) {
    return;
  }

  for (const fulfillmentOrderEdge of fulfillmentOrders) {
    await createFulfillment(
      shopifyClient,
      fulfillmentOrderEdge.node.id,
      declaration,
      order.name
    );
  }
};

// Process a single order
const processOrder = async (
  order: Order,
  connections: any,
  config: any
): Promise<void> => {
  if (!validateOrder(order)) {
    return;
  }

  const novaPoshtaDeclaration = await fetchNovaPoshtaDeclaration(
    order.name,
    config
  );

  if (novaPoshtaDeclaration) {
    await processFulfillment(connections, order, novaPoshtaDeclaration);
  }
};

export const run = async ({ api, connections, config }: any) => {
  // Only run in production environment
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  try {
    // Find unfulfilled orders with "Декларації" tag
    const orders = await api.shopifyOrder.findMany({
      filter: {
        fulfillmentStatus: { notEquals: 'fulfilled' },
        tags: { matches: 'Декларації' },
      },
      select: {
        id: true,
        name: true,
        fulfillmentStatus: true,
        tags: true,
        shopId: true,
      },
    });

    // Process each order
    for (const order of orders) {
      try {
        await processOrder(order, connections, config);
      } catch (error) {
        console.error(`Error processing order ${order.name}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in processDeclarationOrders:', error);
  }
};

export const options = {
  triggers: {
    scheduler: [{ cron: '0 */12 * * *' }],
  },
};
