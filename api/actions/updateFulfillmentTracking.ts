import { updateFulfillmentTracking } from 'api/utilities/shopify/api/orders/updateFulfillmentTracking';
import { authorize } from 'api/utilities/suppliers/authorizeGoogle';
import { google } from 'googleapis';

export const run: ActionRun = async ({
  params,
  connections,
  config,
  logger,
}) => {
  //  const { fulfillmentId, orderName, orderId } = params;
  //  // Move all the Google Sheets and Shopify API logic here
  //  const auth = await authorize(config);
  //  const sheets = google.sheets({ version: 'v4', auth });
  //  // ... rest of the tracking update logic
  //  const updateResult = await updateTracking(
  //    `gid://shopify/Fulfillment/${fulfillmentId}`,
  //    novaPoshtaDeclaration,
  //    connections
  //  );
  //  return { success: true, updateResult };
};

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
