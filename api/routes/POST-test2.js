export default async function route({ request, reply, connections, logger }) {
  const shopify = await connections.shopify.forShopDomain(
    'c2da09-15.myshopify.com'
  );

  if (shopify) {
    try {
      // GraphQL query to fetch orders
      const response = await shopify.graphql(`
          query {
            orders(first: 10) {
              edges {
                node {
                  id
                }
              }
            }
          }
        `);
      logger.info(JSON.stringify(response, null, 2));
      const orders = response.orders.edges.map((edge) => edge.node);
      // Respond with the list of orders
      await reply.send({
        status: 'success',
        orders,
      });
    } catch (error) {
      // Handle any errors during the GraphQL request
      await reply.send({
        error: 'Failed to fetch orders',
        details: error.message,
      });
    }
  } else {
    // Handle the case where Shopify connection is not available
    await reply.send({
      error: 'Shopify connection is not available',
    });
  }
}
