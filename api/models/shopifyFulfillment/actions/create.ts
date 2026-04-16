import { fetchNovaPoshtaDeclaration } from 'api/utilities/fetchDeclarationFromSheet';

import { applyParams, save, ActionOptions } from 'gadget-server';
import { preventCrossShopDataAccess } from 'gadget-server/shopify';



export const run: ActionRun = async ({ params, record }) => {
  applyParams(params, record);
  await preventCrossShopDataAccess(params, record);
  await save(record);
};

export const onSuccess: ActionOnSuccess = async ({ record, api, config, logger }) => {
  let orderName = '';
  if (typeof record.name === 'string' && record.name.length > 0) {
    orderName = record.name.split('.')[0];
  } else {
    logger.warn({ recordName: record.name }, 'record.name is missing or empty');
  }
  const trackingNumbers = record.trackingNumbers as string[] | undefined;
  const currentTrackingNumber = trackingNumbers?.[0] ?? '';

  if (currentTrackingNumber) {
    return;
  }

  const novaPoshtaDeclaration = await fetchNovaPoshtaDeclaration(
    orderName,
    config
  );
  if (!novaPoshtaDeclaration) {
    return;
  }
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
};

export const options: ActionOptions = { actionType: 'create' };
