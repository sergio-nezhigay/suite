import { applyParams, save } from "gadget-server";
import { preventCrossShopDataAccess, shopifySync } from "gadget-server/shopify";

/**
 * @param { import("gadget-server").RunShopifySyncActionContext } context
 */
export async function run({ params, record, logger, api, connections }) {
  applyParams(params, record);
  await preventCrossShopDataAccess(params, record);
  await save(record);
  await shopifySync(params, record);
};

/**
 * @param { import("gadget-server").RunShopifySyncActionContext } context
 */
export async function onSuccess({ params, record, logger, api, connections }) {
  // Your logic goes here
};

/** @type { import("gadget-server").ActionOptions } */
export const options = {
  actionType: "create",
  triggers: { api: true },
};
