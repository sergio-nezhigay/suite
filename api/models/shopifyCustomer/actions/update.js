import { applyParams, save } from "gadget-server";
import { preventCrossShopDataAccess } from "gadget-server/shopify";

/**
 * @param { import("gadget-server").UpdateShopifyCustomerActionContext } context
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
 * @param { import("gadget-server").UpdateShopifyCustomerActionContext } context
 */
export async function onSuccess({ params, record, logger, api, connections }) {
  // Your logic goes here
};

/** @type { import("gadget-server").ActionOptions } */
export const options = { actionType: "update" };
