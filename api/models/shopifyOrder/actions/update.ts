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
  //  console.log(
  //    'update run on api/models/shopifyOrder/actions/update.js............................................'
  //  );
  //  const orderId = record.id;
  //  console.log('Order ID:', orderId);
  //  console.log('Fulfillment Status:', record.fulfillmentStatus);
  //  if (record.fulfillmentStatus === 'fulfilled') {
  //    const testTrackingInfo = {
  //      //  company: '',
  //      number: '20451227952271',
  //      //  url: 'https://novaposhta.ua/tracking/20451227952271',
  //    };
  //    const fulfillments = await fetchFulfillments(orderId, connections);
  //    console.log('fulfillments:', JSON.stringify(fulfillments, null, 2));
  //    console.log('fulfilled Order ID:', orderId);
  //    console.log('Full record:', record);
  //    if (fulfillments.length > 0 && fulfillments[0].trackingInfo?.length === 0) {
  //      const updateResult = await updateFulfillmentTracking({
  //        fulfillmentId: fulfillments[0].id,
  //        trackingInfo: testTrackingInfo,
  //        notifyCustomer: false,
  //        connections,
  //      });
  //      console.log(
  //        'Tracking info has been updated, updateResult- ',
  //        JSON.stringify(updateResult, null, 2)
  //      );
  //    }
  //    try {
  //      const auth = await authorize(config);
  //      const sheets = google.sheets({ version: 'v4', auth });
  //      const startRow = 6901;
  //      const range = `Аркуш1!A${startRow}:O`;
  //      const response = await sheets.spreadsheets.values.get({
  //        spreadsheetId: SPREADSHEET_ID,
  //        range,
  //      });
  //      const data = response.data.values;
  //      if (!data?.length) {
  //        console.log('No data found in the specified range.');
  //        return null;
  //      }
  //      console.log('Sample data:', JSON.stringify(data.slice(0, 6), null, 2));
  //      const matchingRow = data.find((row) => row?.[4] === record.name);
  //      if (!matchingRow) {
  //        console.log(`Order ID ${orderId} not found in rows ${startRow}+.`);
  //        return null;
  //      }
  //      const novaPoshtaDeclaration = matchingRow[14];
  //      console.log(
  //        `Order ID ${orderId} has Nova Poshta declaration: ${novaPoshtaDeclaration}`
  //      );
  //      return novaPoshtaDeclaration;
  //    } catch (err) {
  //      console.error('Async operation failed:', err);
  //    }
  //  }
};

export const options: ActionOptions = { actionType: 'update' };
