import {
  applyParams,
  preventCrossShopDataAccess,
  save,
  ActionOptions,
} from 'gadget-server';

import { applyTags } from '../../../utilities/utils';

/** @type { ActionRun } */
export const run = async ({ params, record }) => {
  applyParams(params, record);
  await preventCrossShopDataAccess(params, record);
  await save(record);
};

/** @type { ActionOnSuccess } */
export const onSuccess = async ({ record, api, connections }) => {
  const shopify = connections.shopify.current;
  const lastSKURecord = await api.lastSKU.findMany();
  const lastSKU = lastSKURecord[0]?.value;
  const id = lastSKURecord[0]?.id;
  await api.lastSKU.update(id, { value: lastSKU + 1 });
  const productId = `gid://shopify/Product/${record.id}`;
  const result = await mutationMetafield(
    shopify,
    productId,
    'custom',
    'product_number_1',
    lastSKU + 1
  );

  if (record.body) {
    await applyTags({
      body: record.body,
      tags: record.tags,
      id: record.id,
    });
  }
};

/** @type { ActionOptions } */
export const options = {
  actionType: 'create',
};

async function mutationMetafield(
  shopify,
  ownerId,
  namespace,
  key,
  value,
  type = 'single_line_text_field'
) {
  const metafieldMutation = `
      mutation UpdateMetafield($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            value
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

  const variables = {
    metafields: [{ ownerId, namespace, key, value: String(value), type }],
  };

  try {
    const response = await shopify.graphql(metafieldMutation, variables);
    if (response.metafieldsSet.userErrors.length > 0) {
      throw new Error(
        `Metafield update failed: ${response.metafieldsSet.userErrors
          .map((error) => `${error.field}: ${error.message}`)
          .join(', ')}`
      );
    }

    return response.metafieldsSet.metafields;
  } catch (error) {
    console.error('Error updating metafield:', error.message);
    throw error;
  }
}
