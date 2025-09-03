import { applyParams, save } from 'gadget-server';
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
}) => {};

/** @type { import('gadget-server').ActionOptions } */
export const options = { actionType: 'create' };
