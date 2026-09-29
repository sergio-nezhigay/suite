import { timeIt } from 'api/utilities/timeIt';

export interface FulfillmentOrderEdge {
  node: {
    id: string;
    status: string;
  };
}

// Get fulfillment orders for a given order
export const getFulfillmentOrders = async (
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
export const replaceOrderTag = async (
  shopifyClient: any,
  orderId: string,
  oldTag: string,
  newTag: string,
  orderName: string,
  logger: any
): Promise<void> => {
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
    logger.error({ orderName, userErrors: removeResponse.tagsRemove.userErrors }, 'Tag removal errors for order');
  }

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
    logger.error({ orderName, userErrors: addResponse.tagsAdd.userErrors }, 'Tag addition errors for order');
  }
};

// Create fulfillment for a fulfillment order
export const createFulfillment = async (
  shopifyClient: any,
  fulfillmentOrderId: string,
  trackingNumber: string,
  orderName: string,
  logger: any,
  message = 'Order fulfilled via Nova Poshta declaration processing'
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
      message,
    }
  );

  if (fulfillmentResponse.fulfillmentCreate.userErrors?.length > 0) {
    logger.error({ orderName, userErrors: fulfillmentResponse.fulfillmentCreate.userErrors }, 'Fulfillment creation errors for order');
    return false;
  }

  return true;
};

// Process fulfillment for an order with declaration
export const processFulfillment = async (
  shopifyClient: any,
  order: { id: string; name: string },
  declaration: string,
  logger: any,
  message?: string
): Promise<boolean> => {
  const fulfillmentOrders = await timeIt('get_fulfillment_orders',
    () => getFulfillmentOrders(shopifyClient, order.id), logger, { orderId: order.id });

  if (fulfillmentOrders.length === 0) {
    return false;
  }

  let allSuccessful = true;

  for (const fulfillmentOrderEdge of fulfillmentOrders) {
    const result = await timeIt('create_fulfillment',
      () => createFulfillment(shopifyClient, fulfillmentOrderEdge.node.id, declaration, order.name, logger, message),
      logger,
      { orderId: order.id, fulfillmentOrderId: fulfillmentOrderEdge.node.id }
    );
    if (!result) {
      allSuccessful = false;
    }
  }

  return allSuccessful;
};
