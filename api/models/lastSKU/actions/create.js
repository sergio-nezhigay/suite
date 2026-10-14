import { applyParams, save } from "gadget-server";

/** @type { ActionRun } */
export const run = async ({ params, record, logger, api, connections }) => {
  applyParams(params, record);
  await save(record);
};

/** @type { import("gadget-server").ActionOptions } */
export const options = {
  actionType: "create",
};
