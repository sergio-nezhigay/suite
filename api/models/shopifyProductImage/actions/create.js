import { applyParams, save, ActionOptions } from 'gadget-server';
import { preventCrossShopDataAccess } from 'gadget-server/shopify';

/** @type { ActionRun } */
export const run = async ({
  params,
  record,
  logger,
  api,
  connections,
  trigger,
}) => {
  applyParams(params, record);
  await preventCrossShopDataAccess(params, record);
  if (trigger.type === 'shopify_sync') {
    return;
  }
  await save(record);
};

/** @type { ActionOnSuccess } */
export const onSuccess = async ({
  params,
  record,
  logger,
  api,
  connections,
}) => {
  // Your logic goes here
  // Your logic goes here
};

/** @type { ActionOptions } */
export const options: ActionOptions = {
  actionType: "create",
  triggers: {
    api: true,
  },
    shopify: {
      // Only sync records that match specific criteria
      webhooks: ["products/update"], // Specify which webhooks to listen to
      filter: {
        vendor: "Nike",
      },
      syncSince: "1d", // Only sync records updated in last 1 day
      hasSync: false, // This prevents bulk sync operations
    }
};
