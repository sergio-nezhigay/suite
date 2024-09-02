import { applyParams, save, ActionOptions, CreateSmsTemplatesActionContext } from "gadget-server";

/**
 * @param { CreateSmsTemplatesActionContext } context
 */
export async function run({ params, record, logger, api, connections }) {
  applyParams(params, record);
  await save(record);
};

/**
 * @param { CreateSmsTemplatesActionContext } context
 */
export async function onSuccess({ params, record, logger, api, connections }) {
  // Your logic goes here
};

/** @type { ActionOptions } */
export const options = {
  actionType: "create",
};
