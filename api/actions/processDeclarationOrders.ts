import { fetchNovaPoshtaDeclaration } from '../utilities/fetchDeclarationFromSheet';
import { timeIt } from 'api/utilities/timeIt';

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
  orderName: string,
  logger: any
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
    logger.error({ orderName, userErrors: removeResponse.tagsRemove.userErrors }, 'Tag removal errors for order');
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
    logger.error({ orderName, userErrors: addResponse.tagsAdd.userErrors }, 'Tag addition errors for order');
  }
};

// Create fulfillment for a fulfillment order
const createFulfillment = async (
  shopifyClient: any,
  fulfillmentOrderId: string,
  trackingNumber: string,
  orderName: string,
  logger: any
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
    logger.error({ orderName, userErrors: fulfillmentResponse.fulfillmentCreate.userErrors }, 'Fulfillment creation errors for order');
    return false;
  }

  return true;
};

// Process fulfillment for an order with declaration
const processFulfillment = async (
  shopifyClient: any,
  order: Order,
  declaration: string,
  logger: any
): Promise<boolean> => {
  const fulfillmentOrders = await timeIt('get_fulfillment_orders',
    () => getFulfillmentOrders(shopifyClient, order.id), logger, { orderId: order.id });

  if (fulfillmentOrders.length === 0) {
    return false;
  }

  let allSuccessful = true;

  for (const fulfillmentOrderEdge of fulfillmentOrders) {
    const result = await timeIt('create_fulfillment',
      () => createFulfillment(shopifyClient, fulfillmentOrderEdge.node.id, declaration, order.name, logger),
      logger,
      { orderId: order.id, fulfillmentOrderId: fulfillmentOrderEdge.node.id }
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
  config: any,
  logger: any
): Promise<void> => {
  if (!validateOrder(order)) {
    return;
  }

  const novaPoshtaDeclaration = await timeIt('fetch_nova_poshta_declaration',
    () => fetchNovaPoshtaDeclaration(order.name, config), logger, { orderName: order.name });

  if (novaPoshtaDeclaration) {
    const fulfillmentSuccess = await processFulfillment(
      shopifyClient,
      order,
      novaPoshtaDeclaration,
      logger
    );

    // Replace order tag if fulfillment was successful
    if (fulfillmentSuccess) {
      try {
        await timeIt('replace_order_tag',
          () => replaceOrderTag(shopifyClient, order.id, 'Декларації', 'Завершені', order.name, logger),
          logger,
          { orderName: order.name }
        );
      } catch (error) {
        logger.error({ orderName: order.name, err: error }, 'Failed to update tag for order');
      }
    }
  }
};

export const run = async ({ api, connections, config, logger }: any) => {
  // Only run in production environment
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const actionStart = performance.now();
  let orders_fulfilled = 0;
  let orders_skipped = 0;

  try {
    // Find unfulfilled orders with "Декларації" tag
    const orders = await timeIt<any[]>('query_orders_with_declaration_tag',
      () => api.shopifyOrder.findMany({
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
      }),
      logger
    );

    if (orders.length === 0) return;

    const shopifyClient = await connections.shopify.forShopId(orders[0].shopId);

    // Process each order
    for (const order of orders) {
      try {
        await processOrder(order, shopifyClient, config, logger);
        orders_fulfilled++;
      } catch (error) {
        logger.error({ orderName: order.name, err: error }, 'Error processing order');
        orders_skipped++;
      }
    }

    logger.info({
      stage: 'declaration_processing_summary',
      orders_found: orders.length,
      orders_fulfilled,
      orders_skipped,
      total_duration_ms: Math.round(performance.now() - actionStart),
    }, 'Declaration processing summary');
  } catch (error) {
    logger.error({ err: error }, 'Error in processDeclarationOrders');
  }
};


export const options = {
  triggers: {
    scheduler: [],
  },
};