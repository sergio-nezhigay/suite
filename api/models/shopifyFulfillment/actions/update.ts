import { updateFulfillmentTracking } from 'api/utilities/shopify/api/orders/updateFulfillmentTracking';
import { authorize } from 'api/utilities/suppliers/authorizeGoogle';
import { applyParams, save, ActionOptions } from 'gadget-server';
import { preventCrossShopDataAccess } from 'gadget-server/shopify';
import { google } from 'googleapis';
import { config } from 'process';
const SPREADSHEET_ID = '1IE-6iZ0tgTPdg0RzWhdzRMv0tca9x5Th8BIg5P0gjwE';

export const run: ActionRun = async ({ params, record }) => {
  applyParams(params, record);
  await preventCrossShopDataAccess(params, record);
  await save(record);
};

export const onSuccess: ActionOnSuccess = async ({ record, connections }) => {
  console.log('onSuccess');
  console.log(
    'shopify fullfillment Record updated successfully:',
    JSON.stringify(record, null, 2)
  );

  const trackingNumbers = record.trackingNumbers as string[] | undefined;
  const currentTrackingNumber = trackingNumbers?.[0] ?? '';
  if (!currentTrackingNumber) {
    console.warn('No current tracking number found');
    const fulfillmentId = `gid://shopify/Fulfillment/${record.id}`;
    console.log('Fulfillment ID:', fulfillmentId);

    const shopifyOrderId = record.orderId || '';
    console.log('fullfillment Shopify Order ID:', shopifyOrderId);

    const auth = await authorize(config);
    const sheets = google.sheets({ version: 'v4', auth });
    const startRow = 6901;
    const range = `Аркуш1!A${startRow}:O`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });
    const data = response.data.values;
    if (!data?.length) {
      console.log('No data found in the specified range.');
      return null;
    }
    console.log('Sample data:', JSON.stringify(data.slice(0, 6), null, 2));
    const orderName = record.name?.split('.')[0] ?? '';
    console.log('Order name:', orderName);
    const matchingRow = data.find((row) => row?.[4] === orderName);
    if (!matchingRow) {
      console.log(`Order name ${orderName} not found in rows ${startRow}+.`);
      return null;
    }
    const novaPoshtaDeclaration = matchingRow[14];

    const updateResult = await updateFulfillmentTracking({
      fulfillmentId: fulfillmentId,
      trackingInfo: novaPoshtaDeclaration,
      notifyCustomer: false,
      connections,
    });
    console.log(
      'Tracking info has been updated, updateResult- ',
      JSON.stringify(updateResult, null, 2)
    );
    return;
  }
};

export const options: ActionOptions = { actionType: 'update' };
