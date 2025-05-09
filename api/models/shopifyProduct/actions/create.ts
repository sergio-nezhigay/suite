import {
  applyParams,
  preventCrossShopDataAccess,
  save,
  ActionOptions,
} from 'gadget-server';
import { getShopifyClient, updateMetafield } from 'utilities';

export const run: ActionRun = async ({ params, record }) => {
  applyParams(params, record);
  await preventCrossShopDataAccess(params, record);
  await save(record);
};

export const onSuccess: ActionOnSuccess = async ({
  record,
  api,
  connections,
}) => {
  console.log("onSuccess create product start...")
  const shopify = getShopifyClient(connections);
  await updateSKU(api, shopify, record);
  if (!record.descriptionEmbedding && record.body && record.title) {
    await api.enqueue(api.shopifyProduct.createEmbedding, { id: record.id });
  }
};

async function updateSKU(
  api: any,
  shopify: any,
  record: Record<string, any>
): Promise<void> {
  const { currentSKUValue, skuRecordId } = await getLastSKU(api);

  await api.lastSKU.update(skuRecordId, { value: currentSKUValue + 1 });
  const variables = {
    metafields: [
      {
        ownerId: `gid://shopify/Product/${record.id}`,
        namespace: 'custom',
        key: 'product_number_1',
        value: String(+currentSKUValue + 1),
        type: 'number_integer',
      },
    ],
  };
  await updateMetafield({ shopify, variables });
}

async function getLastSKU(
  api: any
): Promise<{ currentSKUValue: number; skuRecordId: string }> {
  const lastSKURecord = await api.lastSKU.findMany();
  const currentSKUValue = lastSKURecord[0]?.value;
  const skuRecordId = lastSKURecord[0]?.id;
  return { currentSKUValue, skuRecordId };
}

export const options: ActionOptions = {
  actionType: 'create',
};
