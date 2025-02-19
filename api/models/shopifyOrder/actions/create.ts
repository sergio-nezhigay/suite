import Shopify from 'shopify-api-node';

import {
  applyParams,
  preventCrossShopDataAccess,
  save,
  ActionOptions,
} from 'gadget-server';
import { getShopifyClient, updateMetafield } from 'utilities';

interface Order {
  transactions: { gateway: string }[];
  shippingAddress: Address;
}

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

interface OrderGatewayAndAddress {
  gateway: string;
  shippingAddress: Address;
}

interface FindBestWarehouseResult {
  bestWarehouse: Warehouse;
  matchProbability: number;
}

export const run: ActionRun = async ({ params, record }) => {
  applyParams(params, record);
  await preventCrossShopDataAccess(params, record);
  await save(record);
};

export const onSuccess: ActionOnSuccess = async ({ record, connections }) => {
  try {
    const shopify = getShopifyClient(connections);
    const orderId = `gid://shopify/Order/${record.id}`;

    const { gateway, shippingAddress } = await getOrderGatewayAndAddress({
      shopify,
      orderId,
    }).catch((err) => {
      console.error('Error fetching order gateway and address:', err);
      throw err;
    });

    const paymentMethod =
      gateway === 'Накладений платіж'
        ? 'Накладений платіж'
        : 'Передплата безготівка';

    const { bestWarehouse, matchProbability } = await findBestWarehouse({
      shippingAddress,
    }).catch((err) => {
      console.error('Error finding best warehouse:', err);
      throw err;
    });

    const variables = {
      metafields: [
        {
          ownerId: orderId,
          namespace: 'custom',
          key: 'payment_method',
          value: paymentMethod,
          type: 'single_line_text_field',
        },
        {
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
        },
      ],
    };

    await updateMetafield({ shopify, variables }).catch((err) => {
      console.error('Error updating metafield:', err);
      throw err;
    });

    console.log('onSuccess completed successfully for Order ID:', orderId);
  } catch (err) {
    console.error('Error in onSuccess function:', err);
  }
};

export const options: ActionOptions = {
  actionType: 'create',
};

async function getOrderGatewayAndAddress({
  shopify,
  orderId,
}: {
  shopify: Shopify;
  orderId: string;
}): Promise<OrderGatewayAndAddress> {
  const orderQuery = `
    query GetOrderPaymentGatewayNames($id: ID!)  {
        order(id: $id) {
            transactions {
                gateway
            }
            shippingAddress {
                address1
                city
            }
        }
    }
`;
  const variables = {
    id: orderId,
  };
  const { order }: { order: Order } = await shopify.graphql(
    orderQuery,
    variables
  );

  return {
    gateway: order?.transactions?.[0]?.gateway,
    shippingAddress: order?.shippingAddress,
  };
}

async function findBestWarehouse({
  shippingAddress,
}: {
  shippingAddress: Address;
}): Promise<FindBestWarehouseResult> {
  try {
    const response = await fetch('https://novaposhta.gadget.app/find', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(shippingAddress),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(
        `Nova Poshta API error: Status ${response.status}, Body: ${errorText}`
      );
      throw new Error(`Fetching best warehouse failed`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error finding best warehouse:', error);

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
}
