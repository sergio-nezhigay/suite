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

  // Check multiple possible locations for line items
  try {
    console.log('[ShopifyOrder] Checking all possible line item locations...');

    // Check params.line_items (most common)
    if (params?.line_items) {
      console.log('[ShopifyOrder] Found line_items in params');
      console.log(
        '[ShopifyOrder] Line items data:',
        JSON.stringify(params.line_items, null, 2)
      );
    }

    // Check params.lineItems (camelCase)
    if (params?.lineItems) {
      console.log('[ShopifyOrder] Found lineItems in params');
      console.log(
        '[ShopifyOrder] Line items data:',
        JSON.stringify(params.lineItems, null, 2)
      );
    }

    // Check record.lineItems
    if (record?.lineItems) {
      console.log('[ShopifyOrder] Found lineItems in record');
      console.log(
        '[ShopifyOrder] Line items data:',
        JSON.stringify(record.lineItems, null, 2)
      );
    }

    // Check if it's nested deeper in params
    if (params?.order?.line_items) {
      console.log('[ShopifyOrder] Found line_items in params.order');
      console.log(
        '[ShopifyOrder] Line items data:',
        JSON.stringify(params.order.line_items, null, 2)
      );
    }

    // Search for any property containing "line" in the name
    const paramsKeys = Object.keys(params || {});
    const lineKeys = paramsKeys.filter((key) =>
      key.toLowerCase().includes('line')
    );
    if (lineKeys.length > 0) {
      console.log('[ShopifyOrder] Found keys containing "line":', lineKeys);
      lineKeys.forEach((key) => {
        console.log(`[ShopifyOrder] ${key}:`, params[key]);
      });
    }

    // If still nothing found, log a sample of all params properties
    console.log('[ShopifyOrder] First 5 params properties for debugging:');
    const sampleKeys = Object.keys(params || {}).slice(0, 5);
    sampleKeys.forEach((key) => {
      console.log(
        `[ShopifyOrder] ${key}:`,
        typeof params[key],
        Array.isArray(params[key])
          ? `Array(${params[key].length})`
          : params[key]
      );
    });
  } catch (error) {
    console.log('[ShopifyOrder] Error processing line items:', error);
  }
};
export const options: ActionOptions = { actionType: 'update' };
