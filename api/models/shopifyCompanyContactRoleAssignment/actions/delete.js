import { deleteRecord } from 'gadget-server';
import { preventCrossShopDataAccess } from 'gadget-server/shopify';

/**
 * @param { import("gadget-server").DeleteShopifyCompanyContactRoleAssignmentActionContext } context
 */
export async function run({ params, record, logger, api, connections }) {
  await preventCrossShopDataAccess(params, record);
  await deleteRecord(record);
}

/**
 * @param { import("gadget-server").DeleteShopifyCompanyContactRoleAssignmentActionContext } context
 */
export async function onSuccess({ params, record, logger, api, connections }) {
  // Your logic goes here
}

/** @type { import("gadget-server").ActionOptions } */
export const options = {
  actionType: 'delete',
  triggers: {
    api: true,
  },
};
