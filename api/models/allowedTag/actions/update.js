import { applyParams, save } from "gadget-server";

/**
 * @param { import("gadget-server").UpdateAllowedTagActionContext } context
 */
export async function run({ params, record, logger, api, connections }) {
  applyParams(params, record);
  await save(record);
};

/**
 * @param { import("gadget-server").UpdateAllowedTagActionContext } context
 */
export async function onSuccess({ params, record, logger, api, connections }) {
  // Your logic goes here
};

/** @type { import("gadget-server").ActionOptions } */
export const options = {
  actionType: "update",
};
