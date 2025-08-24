import { acceptFulfillmentOrderRequest } from 'api/utilities/shopify/api/orders/acceptFulfillmentOrderRequest';
import { fetchFulfillments } from 'api/utilities/shopify/api/orders/fetchFulfillments';
import { updateFulfillmentTracking } from 'api/utilities/shopify/api/orders/updateFulfillmentTracking';
import { applyParams, save, ActionOptions } from 'gadget-server';
import { preventCrossShopDataAccess } from 'gadget-server/shopify';

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
  params,
  record,
  logger,
  api,
  connections,
}) => {
  console.log('onSuccess');
  console.log(
    'shopify fullfillment Record updated successfully:',
    JSON.stringify(record, null, 2)
  );

  const fulfillmentId = `gid://shopify/Fulfillment/${record.id}`;
  console.log('Fulfillment ID:', fulfillmentId);

  const shopifyOrderId = record.orderId || '';
  console.log('fullfillment Shopify Order ID:', shopifyOrderId);

  const testTrackingInfo = {
    company: 'Other',
    number: '99999999999999999',
    url: 'https://wwwapps.ups.com/WebTracking/track?track=yes&trackNums=99999999999999999',
  };

  const fullfillments_separate = fetchFulfillments(shopifyOrderId, connections);
  console.log(
    'fullfillments_separate',
    JSON.stringify(fullfillments_separate, null, 2)
  );

  const updateResult = await updateFulfillmentTracking({
    fulfillmentId: fulfillmentId,
    trackingInfo: testTrackingInfo,
    notifyCustomer: false,
    connections,
  });
  console.log(
    'Tracking info has been updated, updateResult- ',
    JSON.stringify(updateResult, null, 2)
  );
};

export const options: ActionOptions = { actionType: 'update' };
