import { applyParams, save, ActionOptions } from 'gadget-server';
import { preventCrossShopDataAccess } from 'gadget-server/shopify';
import { applyTags } from '../../../utilities';

/** @type { ActionRun } */
export const run = async ({ params, record }) => {
  applyParams(params, record);
  await preventCrossShopDataAccess(params, record);
  await save(record);
};

/** @type { ActionOnSuccess } */
//export const onSuccess = async ({ record, logger, api, connections }) => {
//  if (record.body && record.changed('body')) {
//    await applyTags({
//      body: record.body,
//      tags: record.tags,
//      id: record.id,
//    });
//  }
//};

export const onSuccess = async ({
  params,
  record,
  logger,
  api,
  connections,
}) => {
  // Your logic goes here
};

/** @type { ActionOptions } */
export const options = { actionType: 'update' };
