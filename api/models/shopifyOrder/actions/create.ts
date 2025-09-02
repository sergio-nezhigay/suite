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

const GADGET_APP_URL = 'https://novaposhta.gadget.app';

export const run: ActionRun = async ({ params, record }) => {
  applyParams(params, record);
  await preventCrossShopDataAccess(params, record);
  await save(record);
};

export const onSuccess: ActionOnSuccess = async ({
  record,
  connections,
  trigger,
  logger,
}) => {
  console.log('onSuccess triggered for record:', record.id);

  if (trigger.type === 'shopify_sync') {
    console.log(`Blocking order from sync: ${record.id}`);
    throw new Error('order sync blocked by custom logic');
  }

  try {
    console.log('Getting Shopify client...');
    const shopify = getShopifyClient(connections);
    const orderId = `gid://shopify/Order/${record.id}`;
    console.log('Order ID:', orderId);

    console.log('Fetching order gateway and address...');
    const { gateway, shippingAddress } = await getOrderGatewayAndAddress({
      shopify,
      orderId,
    }).catch((err) => {
      logger.error('Error fetching order gateway and address:', err);
      throw err;
    });
    console.log('Order gateway:', gateway);
    console.log('Shipping address:', shippingAddress);

    const paymentMethod =
      gateway === 'Накладений платіж'
        ? 'Накладений платіж'
        : 'Передплата безготівка';
    console.log('Payment method:', paymentMethod);

    console.log('Finding best warehouse...');
    const { bestWarehouse, matchProbability } = await findBestWarehouse({
      shippingAddress,
    }).catch((err) => {
      logger.error('Error finding best warehouse:', err);
      throw err;
    });
    console.log('Best warehouse:', bestWarehouse);
    console.log('Match probability:', matchProbability);

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
    console.log('Prepared metafield variables:', variables);

    console.log('Updating metafield...');
    await updateMetafield({ shopify, variables })
      .then((result) => {
        console.log('Metafield update result:', result);
      })
      .catch((err) => {
        logger.error('Error updating metafield:', err);
        throw err;
      });

    console.log('onSuccess completed successfully for Order ID:', orderId);
  } catch (err) {
    logger.error('Error in onSuccess function:', err);
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
    const response = await fetch(`${GADGET_APP_URL}/find`, {
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
