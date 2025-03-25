import { applyParams, save } from 'gadget-server';
import { preventCrossShopDataAccess } from 'gadget-server/shopify';

/**
 * @param { import('gadget-server').UpdateShopifyShopActionContext } context
 */
export async function run({ params, record, logger, api, connections }) {
  applyParams(params, record);
  await preventCrossShopDataAccess(params, record);
 /* record.disabledWebhooks = {
    shopifyProduct: true,
    shopifyProductVariant: true,
    shopifyProductMedia: true,
  };*/
  await save(record);
}

/**
 * @param { import('gadget-server').UpdateShopifyShopActionContext } context
 */
export async function onSuccess({ params, record, logger, api, connections }) {
  // Your logic goes here
}

/** @type { import('gadget-server').ActionOptions } */
export const options = { actionType: 'update' };
