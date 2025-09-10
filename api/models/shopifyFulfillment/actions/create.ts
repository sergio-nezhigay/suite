import { authorize } from 'api/utilities/suppliers/authorizeGoogle';
import { applyParams, save, ActionOptions } from 'gadget-server';
import { preventCrossShopDataAccess } from 'gadget-server/shopify';
import { google } from 'googleapis';

const SPREADSHEET_ID = '1IE-6iZ0tgTPdg0RzWhdzRMv0tca9x5Th8BIg5P0gjwE';

function logWithOrder(orderName: string, ...args: any[]) {
  console.log(`Create fulfillment action. [Order: ${orderName}]`, ...args);
}

export const run: ActionRun = async ({ params, record }) => {
  applyParams(params, record);
  await preventCrossShopDataAccess(params, record);
  await save(record);
};

async function fetchNovaPoshtaDeclaration(
  orderName: string,
  config: any
): Promise<string | null> {
  try {
    console.time(`[${orderName}] Step 1: Authorize & get sheets client`);
    const auth = await authorize(config);
    const sheets = google.sheets({ version: 'v4', auth });
    console.timeEnd(`[${orderName}] Step 1: Authorize & get sheets client`);

    const startRow = 7100;
    const range = `Аркуш1!A${startRow}:O`;

    console.time(`[${orderName}] Step 2: Fetch & process spreadsheet data`);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });
    const data = response.data.values;
    if (!data?.length) {
      console.log('No data found in the specified range.');
      console.timeEnd(
        `[${orderName}] Step 2: Fetch & process spreadsheet data`
      );
      return null;
    }
    const matchingRow = data.find((row) => row?.[4] === orderName);
    if (!matchingRow) {
      console.log(`orderName ${orderName} not found in rows ${startRow}+.`);
      console.timeEnd(
        `[${orderName}] Step 2: Fetch & process spreadsheet data`
      );
      return null;
    }
    console.timeEnd(`[${orderName}] Step 2: Fetch & process spreadsheet data`);
    return matchingRow[14] ?? null;
  } catch (error) {
    console.error(`[${orderName}] Error in fetchNovaPoshtaDeclaration:`, error);
    return null;
  }
}

export const onSuccess: ActionOnSuccess = async ({ record, api, config }) => {
  let orderName = '';
  if (typeof record.name === 'string' && record.name.length > 0) {
    orderName = record.name.split('.')[0];
  } else {
    console.warn('record.name is missing or empty:', record.name);
  }

  logWithOrder(orderName, '✅ onSuccess - Record created successfully');

  const trackingNumbers = record.trackingNumbers as string[] | undefined;
  const currentTrackingNumber = trackingNumbers?.[0] ?? '';

  if (currentTrackingNumber) {
    logWithOrder(orderName, '⚠️ Tracking number already exists, skipping...');
    return;
  }

  const novaPoshtaDeclaration = await fetchNovaPoshtaDeclaration(
    orderName,
    config
  );
  if (!novaPoshtaDeclaration) {
    return;
  }
  console.log(
    `orderName ${orderName} has Nova Poshta declaration: ${novaPoshtaDeclaration}`
  );

  await api.enqueue(api.writeToShopify, {
    shopId: record.shopId,
    mutation: `
      mutation fulfillmentTrackingInfoUpdate($fulfillmentId: ID!, $trackingInfos: [FulfillmentTrackingInput!]!) {
        fulfillmentTrackingInfoUpdate(id: $fulfillmentId, trackingInfos: $trackingInfos) {
          fulfillment { id }
          userErrors { field message }
        }
      }
    `,
    variables: {
      fulfillmentId: `gid://shopify/Fulfillment/${record.id}`,
      trackingInfos: [
        {
          number: novaPoshtaDeclaration,
          company: 'Other',
          url: `https://novaposhta.ua/tracking/${novaPoshtaDeclaration}`,
        },
      ],
    },
  });

  //  const rozetkaOrderNumber = orderName.match(/\d{9}/);
  //  if (rozetkaOrderNumber) {
  //    await api.enqueue(api.updateRozetkaOrderStatus, {
  //      orderNumber: Number(rozetkaOrderNumber[0]),
  //      status: 61,
  //    });
  //  }

  logWithOrder(orderName, '✅ Background actions enqueued successfully');
};

export const options: ActionOptions = { actionType: 'create' };
