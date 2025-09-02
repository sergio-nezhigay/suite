import { applyParams, save, ActionOptions } from 'gadget-server';
import { preventCrossShopDataAccess } from 'gadget-server/shopify';

function logWithOrder(orderName: string, ...args: any[]) {
  console.log(`Create fulfillment action log. [Order: ${orderName}]`, ...args);
}

export const run: ActionRun = async ({ params, record }) => {
  applyParams(params, record);
  await preventCrossShopDataAccess(params, record);
  await save(record);
};

export const onSuccess: ActionOnSuccess = async ({ record, api }) => {
  const orderName = record.name?.split('.')[0] ?? '';

  logWithOrder(orderName, '✅ onSuccess - Record created successfully');

  const trackingNumbers = record.trackingNumbers as string[] | undefined;
  const currentTrackingNumber = trackingNumbers?.[0] ?? '';

  if (currentTrackingNumber) {
    logWithOrder(
      orderName,
      '⚠️ Tracking number already exists, skipping update'
    );
    return;
  }
  //  await api.enqueue(api.updateFulfillmentTracking, {
  //    fulfillmentId: record.id,
  //    orderName: orderName,
  //    orderId: record.orderId || '',
  //  });

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
