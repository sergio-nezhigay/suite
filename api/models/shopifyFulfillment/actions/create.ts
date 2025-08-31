import { applyParams, save, ActionOptions } from 'gadget-server';
import { preventCrossShopDataAccess } from 'gadget-server/shopify';
import { changeRozetkaOrderStatus } from 'api/utilities/rozetka/changeRozetkaOrderStatus';
import { getRozetkaAccessToken } from 'api/utilities/rozetka/getRozetkaAccessToken';
import { updateFulfillmentTracking } from 'api/utilities/shopify/api/orders/updateFulfillmentTracking';
import { authorize } from 'api/utilities/suppliers/authorizeGoogle';
import { google } from 'googleapis';

// Helper to prefix logs with order number
function logWithOrder(orderName: string, ...args: any[]) {
  console.log(`Create fulfillment action log. [Order: ${orderName}]`, ...args);
}

const SPREADSHEET_ID = '1IE-6iZ0tgTPdg0RzWhdzRMv0tca9x5Th8BIg5P0gjwE';
const SHEET_NAME = 'Аркуш1';
const START_ROW = 6901;

// Find a matching row by Shopify order name
function findOrderRow(data: string[][], orderName: string): string[] | null {
  return data.find((row) => row?.[4] === orderName) ?? null;
}

// Update tracking info in Shopify
async function updateTracking(
  fulfillmentId: string,
  novaPoshtaDeclaration: string,
  connections: any
) {
  return await updateFulfillmentTracking({
    fulfillmentId,
    trackingInfo: {
      number: novaPoshtaDeclaration,
      url: `https://novaposhta.ua/en/tracking/${novaPoshtaDeclaration}`,
      company: 'Nova Poshta',
    },
    notifyCustomer: false,
    connections,
  });
}

export const run: ActionRun = async ({
  params,
  record,
  logger,
  api,
  connections,
}) => {
  applyParams(params, record);
  await preventCrossShopDataAccess(params, record);
  await save(record);
};

export const onSuccess: ActionOnSuccess = async ({
  record,
  connections,
  config,
}) => {
  const orderName = record.name?.split('.')[0] ?? '';

  logWithOrder(
    orderName,
    '✅ onSuccess - Record created successfully:',
    JSON.stringify(record, null, 2)
  );

  const trackingNumbers = record.trackingNumbers as string[] | undefined;
  const currentTrackingNumber = trackingNumbers?.[0] ?? '';

  if (currentTrackingNumber) {
    logWithOrder(
      orderName,
      '⚠️ Tracking number already exists, skipping update'
    );
    return;
  }

  const fulfillmentId = `gid://shopify/Fulfillment/${record.id}`;
  logWithOrder(orderName, 'Fulfillment ID:', fulfillmentId);

  const shopifyOrderId = record.orderId || '';
  logWithOrder(orderName, 'Shopify Order ID:', shopifyOrderId);

  logWithOrder(orderName, 'Order name:', orderName);

  const auth = await authorize(config);
  const sheets = google.sheets({ version: 'v4', auth });

  const range = `${SHEET_NAME}!A${START_ROW}:O`;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });
  const data = response.data.values ?? [];
  if (!data.length) {
    logWithOrder(orderName, '⚠️ No data found in the specified range');
    return;
  }

  const matchingRow = findOrderRow(data, orderName);
  if (!matchingRow) {
    logWithOrder(
      orderName,
      `⚠️ Order name ${orderName} not found in rows starting from ${START_ROW}`
    );
    return;
  }

  const novaPoshtaDeclaration = matchingRow[14];
  logWithOrder(orderName, 'Nova Poshta declaration:', novaPoshtaDeclaration);

  const updateResult = await updateTracking(
    fulfillmentId,
    novaPoshtaDeclaration,
    connections
  );
  logWithOrder(
    orderName,
    '✅ Tracking info updated:',
    JSON.stringify(updateResult, null, 2)
  );
  const rozetkaOrderNumber = orderName.match(/\d{9}/);
  if (!rozetkaOrderNumber) return;

  const accessToken = await getRozetkaAccessToken();
  if (!accessToken) {
    logWithOrder(orderName, 'Failed to fetch Rozetka access token');
    return;
  }
  changeRozetkaOrderStatus(Number(rozetkaOrderNumber[0]), 61, accessToken);
};

export const options: ActionOptions = { actionType: 'create' };
