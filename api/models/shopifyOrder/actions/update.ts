import {
  applyParams,
  save,
  ActionOptions,
  UpdateShopifyOrderActionContext,
} from 'gadget-server';
import { preventCrossShopDataAccess } from 'gadget-server/shopify';
import { authorize } from 'api/utilities/suppliers/authorizeGoogle';
import { google } from 'googleapis';
import { fetchFulfillments } from 'api/utilities/shopify/api/orders/fetchFulfillments';
import { updateFulfillmentTracking } from 'api/utilities/shopify/api/orders/updateFulfillmentTracking';

const SPREADSHEET_ID = '1IE-6iZ0tgTPdg0RzWhdzRMv0tca9x5Th8BIg5P0gjwE';

/**
 * @param { UpdateShopifyOrderActionContext } context
 */
export const run: ActionRun = async ({ params, record }) => {
  applyParams(params, record);
  await preventCrossShopDataAccess(params, record);
  await save(record);
};

export const onSuccess: ActionOnSuccess = async ({
  record,
  config,
  connections,
}) => {
   console.log(
     'update run on api/models/shopifyOrder/actions/update.js............................................'
   );
   const orderId = record.id;
   console.log('shopifyOrder/actions/update.ts. Order ID:', orderId);

};

export const options: ActionOptions = { actionType: 'update' };
