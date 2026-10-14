import { applyParams, save } from 'gadget-server';

/** @type { ActionRun } */
export const run = async ({ params, record, api, connections }) => {
  applyParams(params, record);
  // Structured log for update action
  await save(record);
};

/** @type { import("gadget-server").ActionOptions } */
export const options = {
  actionType: 'update',
};
