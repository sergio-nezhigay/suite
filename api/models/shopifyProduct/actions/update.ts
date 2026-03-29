import { applyParams, save, ActionOptions } from 'gadget-server';
import { preventCrossShopDataAccess } from 'gadget-server/shopify';

/** @type { ActionRun } */
export const run: ActionRun = async ({ params, record }) => {
  applyParams(params, record);
  await preventCrossShopDataAccess(params, record);
  await save(record);
};

/** @type { ActionOnSuccess } */
export const onSuccess: ActionOnSuccess = async ({ record, api }) => {

};

/** @type { ActionOptions } */
export const options: ActionOptions = {
  actionType: "update",
  triggers: {
    shopify: {
      shopifyFilter: "vendor:Nike",
    },
  },
};
