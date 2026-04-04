import { applyParams, save, ActionOptions } from 'gadget-server';

/** @type { ActionRun } */
export const run = async ({ params, record, api, connections }) => {
  applyParams(params, record);
  // Structured log for update action
  await save(record);
};

/** @type { ActionOptions } */
export const options = {
  actionType: 'update',
};
