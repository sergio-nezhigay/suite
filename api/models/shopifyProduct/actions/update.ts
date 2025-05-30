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
  //  console.log('🚀 ~record.title onSuccess:', record.title);
  //  if (
  //    !record.descriptionEmbedding &&
  //    record.title &&
  //    record.body
  //    //&& record.changed('body') &&
  //    // record.changed('title')
  //  ) {
  //    console.log('🚀 ~ enqueue createEmbedding:');
  //    await api.enqueue(api.shopifyProduct.createEmbedding, { id: record.id });
  //  }
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
