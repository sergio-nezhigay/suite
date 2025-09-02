import { globalShopifySync } from 'gadget-server/shopify';

const HourInMs = 60 * 60 * 1000;

/**
 * @param { import('gadget-server').ScheduledShopifySyncGlobalActionContext } context
 */
export async function run({ params, logger, api, connections }) {
  const syncOnlyModels = connections.shopify.enabledModels
    .filter((model) => model.syncOnly)
    .map((model) => model.apiIdentifier);

  const syncSince = new Date(Date.now() - 25 * HourInMs);

  await globalShopifySync({
    apiKeys: connections.shopify.apiKeys,
    syncSince,
    //models: syncOnlyModels,
    models: [
      'shopifyFulfillment',
      'shopifyFulfillmentEvent',
      'shopifyFulfillmentLineItem',
      'shopifyOrder',
    ],
  });
}

/** @type { import('gadget-server').ActionOptions } */
export const options = {
  triggers: {
    scheduler: [
      {
        every: 'day',
        at: '08:01 UTC',
      },
    ],
  },
};
