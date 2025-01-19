import { complimentaryProductsDesktops } from '../data/complimentaryProductsDesktops';
import { updateMetafield } from 'api/utilities';

export const run: ActionRun = async ({ api, connections }) => {
  const allRecords = [];
  const pauseDuration = 1000;
  const shopify = await connections.shopify.forShopId('86804627772');

  let records = await api.shopifyProduct.findMany({
    first: 200,
    select: {
      id: true,
      title: true,
      body: true,
      vendor: true,
      specificationsType: true,
      specificationsProperties: true,
      specificationsFrequency: true,
      variants: { edges: { node: { price: true, barcode: true } } },
    },
    filter: {
      specificationsProperties: { startsWith: `Для комп'ютера` },
    },
  });
  console.log('🚀 ~ records:', records);
  allRecords.push(...records);
  while (records.hasNextPage) {
    console.log('Pausing before fetching the next batch...');
    await new Promise((resolve) => setTimeout(resolve, pauseDuration));
    records = await records.nextPage();
    allRecords.push(...records);
  }
  const products = allRecords.map((record) => ({
    id: record.id,
    title: record.title || '',
    body: record.body || '',
    vendor: record.vendor || '',
    barcode: record.variants.edges[0]?.node.barcode || '',
    price: record.variants.edges[0]?.node.price || 0,
    specificationsType: record.specificationsType,
    specificationsProperties: record.specificationsProperties,
    specificationsFrequency: record.specificationsFrequency,
  }));
  console.log('🚀 ~ products length:', products.length);

  const value = JSON.stringify(
    complimentaryProductsDesktops.map(({ id }) => `gid://shopify/Product/${id}`)
  );

  for (const product of products) {
    const variables = {
      metafields: [
        {
          ownerId: `gid://shopify/Product/${product.id}`,
          namespace: 'shopify--discovery--product_recommendation',
          //  key: 'related_products',
          key: 'complementary_products',
          value,
          type: 'list.product_reference',
        },
      ],
    };
    await updateMetafield({
      shopify,
      variables,
    });
    await new Promise((resolve) => setTimeout(resolve, pauseDuration));
  }

  console.log('All products have been processed.', allRecords.length);
};
