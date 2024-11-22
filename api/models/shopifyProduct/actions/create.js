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
  const shopify = connections.shopify?.current;
  if (!shopify) {
    throw new Error('Shopify connection is required');
  }

  const { currentSKUValue, skuRecordId } = await getLastSKU(api);

  await api.lastSKU.update(skuRecordId, { value: currentSKUValue + 1 });
  await updateMetafield({
    shopify,
    ownerId: `gid://shopify/Product/${record.id}`,
    value: currentSKUValue + 1,
  });
  //  tags processing
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

async function updateMetafield({ shopify, ownerId, value }) {
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
    metafields: [
      {
        ownerId,
        namespace: 'custom',
        key: 'product_number_1',
        value: String(value),
        type: 'single_line_text_field',
      },
    ],
  };

  const response = await shopify.graphql(metafieldMutation, variables);
  if (response.metafieldsSet.userErrors.length > 0) {
    throw new Error(
      `Metafield update failed: ${response.metafieldsSet.userErrors
        .map((error) => `${error.field}: ${error.message}`)
        .join(', ')}`
    );
  }
  return response.metafieldsSet.metafields;
}

async function getLastSKU(api) {
  const lastSKURecord = await api.lastSKU.findMany();
  const currentSKUValue = lastSKURecord[0]?.value;
  const skuRecordId = lastSKURecord[0]?.id;
  return { currentSKUValue, skuRecordId };
}
