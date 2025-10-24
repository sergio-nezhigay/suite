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

// Replace order tag (remove old status, add new status)
const replaceOrderTag = async (
  shopifyClient: any,
  orderId: string,
  oldTag: string,
  newTag: string,
  orderName: string
): Promise<void> => {
  // Remove old tag
  const removeTagMutation = `
    mutation tagsRemove($id: ID!, $tags: [String!]!) {
      tagsRemove(id: $id, tags: $tags) {
        userErrors {
          field
          message
        }
      }
    }
  `;

  const removeResponse = await shopifyClient.graphql(removeTagMutation, {
    id: `gid://shopify/Order/${orderId}`,
    tags: [oldTag],
  });

  if (removeResponse.tagsRemove?.userErrors?.length > 0) {
    console.error(
      `Tag removal errors for order ${orderName}:`,
      removeResponse.tagsRemove.userErrors
    );
  }

  // Add new tag
  const addTagMutation = `
    mutation tagsAdd($id: ID!, $tags: [String!]!) {
      tagsAdd(id: $id, tags: $tags) {
        userErrors {
          field
          message
        }
      }
    }
  `;

  const addResponse = await shopifyClient.graphql(addTagMutation, {
    id: `gid://shopify/Order/${orderId}`,
    tags: [newTag],
  });

  if (addResponse.tagsAdd?.userErrors?.length > 0) {
    console.error(
      `Tag addition errors for order ${orderName}:`,
      addResponse.tagsAdd.userErrors
    );
  }
};

// Create fulfillment for a fulfillment order
const createFulfillment = async (
  shopifyClient: any,
  fulfillmentOrderId: string,
  trackingNumber: string,
  orderName: string
): Promise<boolean> => {
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
    return false;
  }

  return true;
};

// Process fulfillment for an order with declaration
const processFulfillment = async (
  shopifyClient: any,
  order: Order,
  declaration: string
): Promise<boolean> => {
  const fulfillmentOrders = await getFulfillmentOrders(shopifyClient, order.id);

  if (fulfillmentOrders.length === 0) {
    return false;
  }

  let allSuccessful = true;

  for (const fulfillmentOrderEdge of fulfillmentOrders) {
    const result = await createFulfillment(
      shopifyClient,
      fulfillmentOrderEdge.node.id,
      declaration,
      order.name
    );
    if (!result) {
      allSuccessful = false;
    }
  }

  return allSuccessful;
};

// Process a single order
const processOrder = async (
  order: Order,
  shopifyClient: any,
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
    const fulfillmentSuccess = await processFulfillment(
      shopifyClient,
      order,
      novaPoshtaDeclaration
    );

    // Replace order tag if fulfillment was successful
    if (fulfillmentSuccess) {
      try {
        await replaceOrderTag(
          shopifyClient,
          order.id,
          'Декларації',
          'Завершені',
          order.name
        );
        console.log(
          `Successfully updated tag for order ${order.name}: Декларації → Завершені`
        );
      } catch (error) {
        console.error(
          `Failed to update tag for order ${order.name}:`,
          error
        );
      }
    }
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
        //fulfillmentStatus: { notEquals: 'fulfilled' },
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

    if (orders.length === 0) return;

    const shopifyClient = await connections.shopify.forShopId(orders[0].shopId);

    // Process each order
    for (const order of orders) {
      try {
        await processOrder(order, shopifyClient, config);
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
    scheduler: [{ cron: '11 1,7,13,19 * * *' }],
  },
};