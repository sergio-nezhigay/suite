import {
  applyParams,
  save,
  //  ActionOptions,
  //  CreateShopifyOrderActionContext,
} from 'gadget-server';
import { preventCrossShopDataAccess } from 'gadget-server/shopify';
import { updateMetafield, getShopifyClient } from '../../../utilities';

/**
 * @param { import('gadget-server').CreateShopifyOrderActionContext } context
 */
export async function run({ params, record }) {
  applyParams(params, record);
  await preventCrossShopDataAccess(params, record);
  await save(record);
}

/**
 * @param { import('gadget-server').CreateShopifyOrderActionContext } context
 */
export async function onSuccess({ record, connections }) {
  console.log('🚀 ~ onSuccess:');
  // Your logic goes here
  const shopify = getShopifyClient(connections);
  const orderId = `gid://shopify/Order/${record.id}`;
  const { gateway, shippingAddress } = await getOrderGatewayAndAddress({
    shopify,
    orderId,
  });

  const { bestWarehouse, matchProbability } = await findBestWarehouse({
    shippingAddress,
  });
  console.log('🚀 ~ bestWarehouse:', bestWarehouse);

  const paymentMethod =
    gateway === 'Накладений платіж'
      ? 'Накладений платіж'
      : 'Передплата безготівка';

  const warehouseData = {
    warehouseDescription: bestWarehouse.description,
    cityDescription: bestWarehouse.cityDescription,
    warehouseRef: bestWarehouse.ref,
    cityRef: bestWarehouse.cityRef,
    matchProbability,
  };
  const variables = {
    metafields: [
      {
        ownerId: orderId,
        namespace: 'custom',
        key: 'payment_method',
        value: paymentMethod,
      },
      {
        ownerId: orderId,
        namespace: 'custom',
        key: 'nova_poshta_warehouse',
        value: JSON.stringify(warehouseData),
      },
    ],
  };
  await updateMetafield({ shopify, variables });
}

/** @type { import('gadget-server').ActionOptions } */
export const options = { actionType: 'create' };

export default async function getOrderGatewayAndAddress({ shopify, orderId }) {
  const orderquery = `
            query GetOrderPaymentGatewayNames($id: ID!)  {
                order(id: $id) {
                    id
                    name
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
  const { order } = await shopify.graphql(orderquery, variables);
  console.log('🚀 ~ order:', order);

  return {
    gateway: order?.transactions?.[0]?.gateway,
    shippingAddress: order?.shippingAddress,
  };
}

async function findBestWarehouse({ shippingAddress }) {
  console.log('🚀 ~ shippingAddress:', shippingAddress);
  const response = await fetch('https://novaposhta.gadget.app/find', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(shippingAddress),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  return result;
}
