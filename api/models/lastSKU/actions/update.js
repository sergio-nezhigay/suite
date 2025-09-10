import { applyParams, save, ActionOptions } from 'gadget-server';

/** @type { ActionRun } */
export const run = async ({ params, record, api, connections }) => {
  applyParams(params, record);
  // Structured log for update action
  console.log('[lastSKU/update] Info', {
    params,
    record,
    timestamp: new Date().toISOString(),
  });
  await save(record);
};

/** @type { ActionOptions } */
export const options = {
  actionType: 'update',
};
