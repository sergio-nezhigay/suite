import { applyParams, save, ActionOptions } from 'gadget-server';

export const run: ActionRun = async ({ params, record, api, connections }) => {
  applyParams(params, record);
  // Structured log for chatLog update
  console.log('[chatLog/update] Info', {
    params,
    record,
    timestamp: new Date().toISOString(),
  });
  await save(record);
};

export const options: ActionOptions = {
  actionType: 'update',
};
