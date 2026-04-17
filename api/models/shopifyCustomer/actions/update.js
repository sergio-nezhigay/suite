import { applyParams, save, ActionOptions, UpdateShopifyCustomerActionContext } from "gadget-server";
import { preventCrossShopDataAccess } from "gadget-server/shopify";

/**
 * @param { UpdateShopifyCustomerActionContext } context
 */
export async function run({ params, record, logger, api, connections }) {
  applyParams(params, record);
  await preventCrossShopDataAccess(params, record);
  const RELEVANT_FIELDS = ['firstName', 'lastName', 'email', 'phone'];
  const hasRelevantChange = RELEVANT_FIELDS.some(field => record.changed(field));
  if (!hasRelevantChange) return;
  await save(record);
};

/**
 * @param { UpdateShopifyCustomerActionContext } context
 */
export async function onSuccess({ params, record, logger, api, connections }) {
  // Your logic goes here
};

/** @type { ActionOptions } */
export const options = { actionType: "update" };
