import {
  applyParams,
  preventCrossShopDataAccess,
  save,
  ActionOptions,
} from 'gadget-server';
import { getShopifyClient, updateMetafield } from 'utilities';

interface Address {
  address1: string;
  city: string;
}

interface Warehouse {
  description: string;
  cityDescription: string;
  ref: string;
  cityRef: string;
  settlementAreaDescription?: string;
}

interface FindBestWarehouseResult {
  bestWarehouse: Warehouse;
  matchProbability: number;
}

const GADGET_APP_URL = 'https://novaposhta.gadget.app';

function logWithOrderId({
  message,
  orderId,
}: {
  message: string | object;
  orderId: string;
}) {
  const timestamp = new Date().toISOString();
  const logData = { orderId, timestamp };

  if (typeof message === 'object' && message !== null) {
    const typeName = message.constructor?.name || 'Object';
    const fieldNames = Object.keys(message).join(', ');
    console.log('[shopifyOrder/create] Info', {
      ...logData,
      typeName,
      fieldNames,
      ...message,
    });
  } else {
    console.log('[shopifyOrder/create] Info', { message, ...logData });
  }
}

export const run: ActionRun = async ({ params, record }) => {
  applyParams(params, record);
  await preventCrossShopDataAccess(params, record);
  await save(record);
};

export const onSuccess: ActionOnSuccess = async ({ record, api }) => {
  logWithOrderId({
    message: record,
    orderId: record.id,
  });
  logWithOrderId({
    message: 'onSuccess triggered for record',
    orderId: record.id,
  });

  try {
    const orderId = `gid://shopify/Order/${record.id}`;

    // Step 1: Log before extracting payment method
    logWithOrderId({
      message: 'Extracting payment method',
      orderId: record.id,
    });

    // Extract payment method
    const gateway = Array.isArray(record.paymentGatewayNames)
      ? record.paymentGatewayNames[0]
      : undefined;
    const paymentMethod =
      gateway === 'Передплата безготівка'
        ? 'Передплата безготівка'
        : 'Накладений платіж';
    logWithOrderId({
      message: paymentMethod,
      orderId: record.id,
    });

    // Process shipping address if available
    const address = record.shippingAddress;
    let metafieldsToUpdate = [
      {
        ownerId: orderId,
        namespace: 'custom',
        key: 'payment_method',
        value: paymentMethod,
        type: 'single_line_text_field',
      },
    ];

    if (address && typeof address === 'object' && !Array.isArray(address)) {
      const typedAddress = address as any;
      const shippingAddressString = `${typedAddress.address1 || ''}, ${
        typedAddress.city || ''
      }`;

      // Find best warehouse (your existing logic)
      const { bestWarehouse, matchProbability } = await findBestWarehouse({
        shippingAddress: typedAddress,
      });

      // Add warehouse metafield
      metafieldsToUpdate.push({
        ownerId: orderId,
        namespace: 'nova_poshta',
        key: 'recepient_warehouse',
        value: JSON.stringify({
          warehouseDescription: bestWarehouse.description,
          cityDescription: bestWarehouse.cityDescription,
          warehouseRef: bestWarehouse.ref,
          cityRef: bestWarehouse.cityRef,
          settlementAreaDescription:
            bestWarehouse.settlementAreaDescription || '',
          matchProbability,
        }),
        type: 'json',
      });

      // Add shipping address as a separate metafield
      metafieldsToUpdate.push({
        ownerId: orderId,
        namespace: 'custom',
        key: 'processed_shipping_address',
        value: shippingAddressString,
        type: 'single_line_text_field',
      });
    }

    // Step 2: Log after preparing metafields
    logWithOrderId({
      message: 'Prepared metafields for update',
      orderId: record.id,
    });

    // Step 3: Log before enqueuing metafields update
    logWithOrderId({
      message: 'Enqueuing metafields update',
      orderId: record.id,
    });

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

    logWithOrderId({
      message: 'Metafields enqueued for update',
      orderId: record.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error('[shopifyOrder/create] Error processing order metafields', {
      orderId: record.id,
      message,
      stack,
      timestamp: new Date().toISOString(),
    });
  }
};

export const options: ActionOptions = {
  actionType: 'create',
};

async function findBestWarehouse({
  shippingAddress,
}: {
  shippingAddress: Address;
}): Promise<FindBestWarehouseResult> {
  return {
    bestWarehouse: {
      description: 'Unknown Warehouse',
      cityDescription: shippingAddress.city || 'Unknown City',
      ref: 'N/A',
      cityRef: 'N/A',
      settlementAreaDescription: 'N/A',
    },
    matchProbability: 0,
  };
}
