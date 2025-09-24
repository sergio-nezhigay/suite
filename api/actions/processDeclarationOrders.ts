import { fetchNovaPoshtaDeclaration } from '../utilities/fetchDeclarationFromSheet';

export const run = async ({ api, logger, connections, config }: any) => {
  // Only run in production environment
  if (process.env.NODE_ENV !== 'production') {
    logger.info(
      'Skipping declaration orders processing - not in production environment'
    );
    return;
  }

  logger.info('Starting declaration orders processing');

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

    logger.info(`Found ${orders.length} declaration orders`);

    // Process each order
    for (const order of orders) {
      logger.info(`Processing order: ${order.name} (${order.id})`);

      try {
        if (!order.name) {
          logger.warn(`Order ${order.id} has no name, skipping`);
          continue;
        }

        const novaPoshtaDeclaration = await fetchNovaPoshtaDeclaration(
          order.name,
          config
        );
        console.log(
          'novaPoshtaDeclaration',
          JSON.stringify(novaPoshtaDeclaration, null, 2)
        );

        //if (novaPoshtaDeclaration) {
        //  logger.info(
        //    `Found declaration for order ${order.name}: ${novaPoshtaDeclaration}`
        //  );

        //  // Update or create fulfillment with declaration as tracking number
        //  const existingFulfillments = await api.shopifyFulfillment.findMany({
        //    filter: {
        //      orderId: { equals: order.id },
        //    },
        //  });

        //  if (existingFulfillments.length > 0) {
        //    // Update existing fulfillment
        //    const fulfillment = existingFulfillments[0];
        //    await api.shopifyFulfillment.update(fulfillment.id, {
        //      trackingNumbers: [novaPoshtaDeclaration],
        //      trackingCompany: 'eeasybuy',
        //    });
        //    logger.info(
        //      `Updated fulfillment for order ${order.name} with declaration ${novaPoshtaDeclaration}`
        //    );
        //  } else {
        //    logger.info(
        //      `No existing fulfillment found for order ${order.name} - declaration logged only`
        //    );
        //  }
        //} else {
        //  logger.warn(`No declaration found for order ${order.name}`);
        //}
      } catch (error) {
        logger.error(`Error processing order ${order.name}:`, error);
      }
    }
  } catch (error) {
    logger.error('Error in processDeclarationOrders:', error);
  }
};

export const options = {
  triggers: {
    scheduler: [{ cron: '0 */12 * * *' }],
  },
};
