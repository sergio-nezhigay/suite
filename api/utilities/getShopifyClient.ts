import { AppConnections } from '.gadget/server/types';

export default function getShopifyClient(connections: AppConnections) {
  connections.shopify.maxRetries = 10;
  const shopify = connections.shopify.current;

  if (!shopify) {
    throw new Error('Shopify client is not available.');
  }

  return shopify;
}
