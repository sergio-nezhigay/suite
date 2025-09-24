import { fetchNovaPoshtaDeclaration } from 'api/utilities/fetchDeclarationFromSheet';

import { applyParams, save, ActionOptions } from 'gadget-server';
import { preventCrossShopDataAccess } from 'gadget-server/shopify';

function logWithOrder(orderName: string, ...args: any[]) {
  console.log(`Create fulfillment action. [Order: ${orderName}]`, ...args);
}

export const run: ActionRun = async ({ params, record }) => {
  applyParams(params, record);
  await preventCrossShopDataAccess(params, record);
  await save(record);
};

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
      mutation fulfillmentTrackingInfoUpdate($fulfillmentId: ID!, $trackingInfoInput: FulfillmentTrackingInput!) {
        fulfillmentTrackingInfoUpdate(fulfillmentId: $fulfillmentId, trackingInfoInput: $trackingInfoInput, notifyCustomer: false) {
          fulfillment { id }
          userErrors { field message }
        }
      }
    `,
    variables: {
      fulfillmentId: `gid://shopify/Fulfillment/${record.id}`,
      trackingInfoInput: {
        number: novaPoshtaDeclaration,
        company: 'Other',
        url: `https://novaposhta.ua/tracking/${novaPoshtaDeclaration}`,
      },
    },
  });

  logWithOrder(orderName, '✅ Background actions enqueued successfully');
};

export const options: ActionOptions = { actionType: 'create' };
