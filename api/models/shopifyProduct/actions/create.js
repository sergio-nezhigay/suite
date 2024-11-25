import {
  applyParams,
  preventCrossShopDataAccess,
  save,
  ActionOptions,
} from 'gadget-server';
import updateMetafield from '../../../utilities/updateMetafield';
import getShopifyClient from '../../utilities/getShopifyClient';

import { applyTags } from '../../../utilities/utils';

/** @type { ActionRun } */
export const run = async ({ params, record }) => {
  applyParams(params, record);
  await preventCrossShopDataAccess(params, record);
  await save(record);
};

/** @type { ActionOnSuccess } */
export const onSuccess = async ({ record, api, connections }) => {
  const shopify = getShopifyClient(connections);

  const { currentSKUValue, skuRecordId } = await getLastSKU(api);

  await api.lastSKU.update(skuRecordId, { value: currentSKUValue + 1 });
  const variables = {
    metafields: [
      {
        ownerId: `gid://shopify/Product/${record.id}`,
        namespace: 'custom',
        key: 'product_number_1',
        value: String(currentSKUValue + 1),
        type: 'single_line_text_field',
      },
    ],
  };
  await updateMetafield({ shopify, variables });

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

async function getLastSKU(api) {
  const lastSKURecord = await api.lastSKU.findMany();
  const currentSKUValue = lastSKURecord[0]?.value;
  const skuRecordId = lastSKURecord[0]?.id;
  return { currentSKUValue, skuRecordId };
}
