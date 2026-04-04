import { applyParams, save, ActionOptions } from 'gadget-server';

export const run: ActionRun = async ({ params, record, api, connections }) => {
  applyParams(params, record);
  // Structured log for chatLog update
  await save(record);
};

export const options: ActionOptions = {
  actionType: 'update',
};
