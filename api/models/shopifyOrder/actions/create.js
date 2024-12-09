import {
  applyParams,
  save,
  ActionOptions,
  CreateShopifyOrderActionContext,
} from 'gadget-server';
import { preventCrossShopDataAccess } from 'gadget-server/shopify';
import { updateMetafield, getShopifyClient } from '../../../utilities';

/**
 * @param { CreateShopifyOrderActionContext } context
 */
export async function run({ params, record }) {
  applyParams(params, record);
  await preventCrossShopDataAccess(params, record);
  await save(record);
}

/**
 * @param { CreateShopifyOrderActionContext } context
 */
export async function onSuccess({ record, connections }) {
  // Your logic goes here
  const shopify = getShopifyClient(connections);
  const orderId = `gid://shopify/Order/${record.id}`;
  const gateWays = await getOrderGateway({ shopify, orderId });

  const gateway = gateWays?.[0]?.gateway;

  const paymentMethod =
    gateway === 'Накладений платіж'
      ? 'Накладений платіж'
      : 'Передплата безготівка';
  const variables = {
    metafields: [
      {
        ownerId: orderId,
        namespace: 'custom',
        key: 'payment_method',
        value: paymentMethod,
      },
    ],
  };
  await updateMetafield({ shopify, variables });
}

/** @type { ActionOptions } */
export const options = { actionType: 'create' };

export default async function getOrderGateway({ shopify, orderId }) {
  const orderquery = `
            query GetOrderPaymentGatewayNames($id: ID!)  {
                order(id: $id) {
                    id
                    name
                    transactions {
                        gateway
                    }
                }
            }
        `;
  const variables = {
    id: orderId,
  };
  const { order } = await shopify.graphql(orderquery, variables);

  return order?.transactions;
}
