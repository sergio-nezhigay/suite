import {
  applyParams,
  preventCrossShopDataAccess,
  save,
  ActionOptions,
} from 'gadget-server';

export const run: ActionRun = async ({ params, record, logger }: any) => {
  const start = performance.now();
  try {
    applyParams(params, record);
    await preventCrossShopDataAccess(params, record);
    await save(record);
  } finally {
    const duration_ms = Math.round(performance.now() - start);
    logger?.info({ stage: 'shopify_order_create', duration_ms, orderId: record.id }, 'shopify_order_create completed');
  }
};

export const onSuccess: ActionOnSuccess = async ({ record, api, logger }) => {
  try {
    const orderId = `gid://shopify/Order/${record.id}`;

    // Step 1: Log before extracting payment method
    const gateways = Array.isArray(record.paymentGatewayNames)
      ? record.paymentGatewayNames
      : [];

    // Check if any gateway contains prepayment indicators
    const isPrepaid = gateways.some(
      (gateway) =>
        gateway &&
        typeof gateway === 'string' &&
        (gateway.toLowerCase().includes('передплат') ||
          gateway.toLowerCase().includes('переказ') ||
          gateway.toLowerCase().includes('prepay'))
    );
    const paymentMethod = isPrepaid
      ? 'Передплата безготівка'
      : 'Накладений платіж';
    let metafieldsToUpdate = [
      {
        ownerId: orderId,
        namespace: 'custom',
        key: 'payment_method',
        value: paymentMethod,
        type: 'single_line_text_field',
      },
    ];

    // Step 2: Log after preparing metafields
    // Step 3: Log before enqueuing metafields update
    await api.enqueue(api.writeToShopify, {
      shopId: record.shopId,
      mutation: `
        mutation ($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields {
              id
              namespace
              key
              value
            }
            userErrors {
              field
              message
              code
            }
          }
        }
      `,
      variables: {
        metafields: metafieldsToUpdate,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    logger.error({
      orderId: record.id,
      message,
      stack,
      timestamp: new Date().toISOString(),
    }, '[shopifyOrder/create] Error processing order metafields');
  }
};

export const options: ActionOptions = {
  actionType: 'create',
};
