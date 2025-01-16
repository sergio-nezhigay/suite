export const run: ActionRun = async ({ api, connections, request }) => {
  connections.shopify.maxRetries = 10;
  //  const shopify = connections.shopify.current;

  const shopify = await connections.shopify.forShopId('65276346541');
  if (!shopify) {
    throw new Error('Shopify client is not available.2');
  }
  console.log('Shopify initialized ok');
};
