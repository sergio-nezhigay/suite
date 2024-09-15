import { RouteContext } from 'gadget-server';

export default async function route({
  request,
  reply,
  api,
  connections,
  logger,
}) {
  try {
    // Get Shopify connection using your shop domain
    const shop = await api.shopifyShop.findFirst({ select: { domain: true } });

    if (shop) {
      // Create Shopify connection
      const shopify = await connections.shopify.forShopDomain(shop.domain);

      // Specify the order ID you want to fetch
      const orderId = 'gid://shopify/Order/5638076989613';

      // Query to fetch details of the specified order
      const response = await shopify.graphql(`
        query {
          node(id: "${orderId}") {
            ... on Order {
              id
              name
              totalPrice
              createdAt
              customer {
                firstName
                lastName
                email
              }
            }
          }
        }
      `);

      if (response.node) {
        logger.info(
          'Order details fetched successfully:',
          JSON.stringify(response.node, null, 2)
        );

        // Send back the order information
        await reply.send({
          status: 'success',
          order: response.node,
        });
      } else {
        // Handle case where the order is not found
        await reply.send({
          status: 'error',
          message: 'Order not found.',
        });
      }
    } else {
      // Handle case where no shop is found
      await reply.send({
        status: 'error',
        message: 'No Shopify shop found.',
      });
    }
  } catch (error) {
    // Handle any errors during the query
    await reply.send({
      error: 'Failed to fetch order details',
      details: error.message,
    });
  }
}
