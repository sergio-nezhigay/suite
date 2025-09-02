import { AppConnections } from 'gadget-server';

export function getShopifyClient(connections: AppConnections) {
  connections.shopify.maxRetries = 2;
  const shopify = connections.shopify.current;

  if (!shopify) {
    throw new Error('Shopify client is not available.');
  }

  return shopify;
}
