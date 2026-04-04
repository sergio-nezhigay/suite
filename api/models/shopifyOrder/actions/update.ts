import {
  applyParams,
  save,
  ActionOptions,
  UpdateShopifyOrderActionContext,
} from 'gadget-server';
import { api } from 'gadget-server';
import { preventCrossShopDataAccess } from 'gadget-server/shopify';

/**
 * @param { UpdateShopifyOrderActionContext } context
 */
export const run = async ({ params, record }: any) => {
  applyParams(params, record);
  await preventCrossShopDataAccess(params, record);
  await save(record);
};


export const options: ActionOptions = { actionType: 'update' };
