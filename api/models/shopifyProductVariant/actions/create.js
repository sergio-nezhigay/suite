import { applyParams, save, ActionOptions } from 'gadget-server';
import { preventCrossShopDataAccess } from 'gadget-server/shopify';

/** @type { ActionRun } */
export const run = async ({ params, record, logger, api, connections }) => {
  applyParams(params, record);
  await preventCrossShopDataAccess(params, record);
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
  if (trigger.type === "shopify_sync") {
    logger.info(`Blocking product variant from sync: ${record.id}`);
    throw new Error("product variant sync blocked by custom logic");
  }
};

/** @type { ActionOptions } */
export const options = {
  actionType: "create",
  triggers: {},
};
