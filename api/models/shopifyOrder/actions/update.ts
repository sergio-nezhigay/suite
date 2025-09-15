import {
  applyParams,
  save,
  ActionOptions,
  UpdateShopifyOrderActionContext,
} from 'gadget-server';
import { api } from 'gadget-server';
import { preventCrossShopDataAccess } from 'gadget-server/shopify';

/**
 * @param { UpdateShopifyOrderActionContext } context
 */
export const run = async ({ params, record }: any) => {
  applyParams(params, record);
  await preventCrossShopDataAccess(params, record);
  await save(record);
};

export const onSuccess = async ({
  record,
  params,
  config,
  connections,
}: any) => {
  console.log('[ShopifyOrder] Order update webhook received');

  // Log the entire params structure to see what Shopify is sending
  console.log('[ShopifyOrder] Full webhook params structure:');
  console.log('[ShopifyOrder] Params keys:', Object.keys(params || {}));
  console.log('[ShopifyOrder] Full params:', JSON.stringify(params, null, 2));

  // Also log the record structure
  console.log('[ShopifyOrder] Record keys:', Object.keys(record || {}));

  // Extract and log order details from record
  const orderId = record.id;
  const orderNumber = record.number;
  const totalPrice = record.totalPrice;

  console.log('[ShopifyOrder] Basic order info:', {
    orderId,
    orderNumber,
    totalPrice,
  });

  // Log order tags
  const tags = record.tags || [];
  console.log('[ShopifyOrder] Order tags:', tags);

  // Fetch and log orderLineItems
  //  api.shopifyOrderLineItem.findMany
};
export const options: ActionOptions = { actionType: 'update' };
