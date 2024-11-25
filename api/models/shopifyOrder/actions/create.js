import {
  applyParams,
  save,
  ActionOptions,
  CreateShopifyOrderActionContext,
} from 'gadget-server';
import { preventCrossShopDataAccess } from 'gadget-server/shopify';
import updateMetafield from '../../../utilities/updateMetafield';
import getShopifyClient from '../../../utilities/getShopifyClient';

/**
 * @param { CreateShopifyOrderActionContext } context
 */
export async function run({ params, record, logger, api, connections }) {
  applyParams(params, record);
  await preventCrossShopDataAccess(params, record);
  await save(record);
}

/**
 * @param { CreateShopifyOrderActionContext } context
 */
export async function onSuccess({ params, record, logger, api, connections }) {
  // Your logic goes here
  const shopify = getShopifyClient(connections);
  const orderId = `gid://shopify/Order/${record.id}`;
  const gateWays = await getOrderGateway({ shopify, orderId });
  console.log('🚀 ~ gatwayValues:', gateWays);

  const gateway = gateWays?.[0]?.gateway || null;
  console.log('🚀 ~ gateway:', gateway);

  const variables = {
    metafields: [
      {
        ownerId: orderId,
        namespace: 'custom',
        key: 'payment_method',
        value: gateway,
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
