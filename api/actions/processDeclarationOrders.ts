import { fetchNovaPoshtaDeclaration } from '../utilities/fetchDeclarationFromSheet';
import { timeIt } from 'api/utilities/timeIt';
import { processFulfillment, replaceOrderTag } from 'api/utilities/shopify/fulfillWithDeclaration';

interface Order {
  id: string;
  name: string;
  fulfillmentStatus: string;
  tags: string;
  shopId: string;
}

// Validate order before processing
const validateOrder = (order: Order): boolean => {
  return !!order.name;
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