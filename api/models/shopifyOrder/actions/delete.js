import { deleteRecord } from 'gadget-server';
import { preventCrossShopDataAccess } from 'gadget-server/shopify';

export async function run({ params, record, logger, api, connections }) {
  await preventCrossShopDataAccess(params, record);
  await deleteRecord(record);
}

export async function onSuccess({ params, record, logger, api, connections }) {
  // Your logic goes here
}

export const options = { actionType: 'delete' };
