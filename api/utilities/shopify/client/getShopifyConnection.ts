import { AppConnections } from 'gadget-server';

export async function getShopifyConnection(connections: AppConnections) {
  const shopId =
    process.env.NODE_ENV === 'production' ? '86804627772' : '65276346541';

  const shopify = await connections.shopify.forShopId(shopId);
  if (!shopify) {
    console.error('No Shopify connection available');
    return null;
  }

  return shopify;
}
