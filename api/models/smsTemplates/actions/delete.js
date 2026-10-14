import { deleteRecord } from "gadget-server";

/**
 * @param { import("gadget-server").DeleteSmsTemplatesActionContext } context
 */
export async function run({ params, record, logger, api, connections }) {
  await deleteRecord(record);
};

/**
 * @param { import("gadget-server").DeleteSmsTemplatesActionContext } context
 */
export async function onSuccess({ params, record, logger, api, connections }) {
  // Your logic goes here
};

/** @type { import("gadget-server").ActionOptions } */
export const options = {
  actionType: "delete",
};
