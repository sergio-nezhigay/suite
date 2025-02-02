import { connections } from 'gadget-server';
import { createEmbedding } from 'utilities/ai/embeddings';

export const findSimilarProducts = async ({
  product,
  api,
}: {
  product: any;
  api: any;
}) => {
  const input = stripText(product.title + product.body, [
    product.barcode,
    product.vendor,
  ]);
  const embedding = await createEmbedding(connections, input);

  const filters = {
    specificationsType: { equals: product.specificationsType },
    specificationsProperties: { equals: product.specificationsProperties },
    specificationsFrequency: { equals: product.specificationsFrequency },
  };

  const products = await fetchProducts(api, embedding, filters, 50);

  const filteredProducts = products.filter(({ id }) => id !== product.id);

  const productsBranded = filteredProducts.filter(
    ({ vendor, price }) =>
      vendor === product.vendor && price > (Number(product.price) || 0) * 0.8
  );
  const productsNonBranded = filteredProducts.filter(
    ({ vendor, price }) =>
      vendor !== product.vendor && price > (Number(product.price) || 0) * 0.65
  );

  const finalProducts = [
    ...productsBranded.slice(0, 5),
    ...productsNonBranded.slice(0, 10 - Math.min(5, productsBranded.length)),
  ];

  return finalProducts.map(({ handle, id, title }) => ({ handle, id, title }));
};

const fetchProducts = async (
  api: any,
  embedding: any,
  filters: Record<string, any> = {},
  limit: number = 10
): Promise<any[]> => {
  const rawProducts = await api.shopifyProduct.findMany({
    sort: { descriptionEmbedding: { cosineSimilarityTo: embedding } },
    first: limit,
    filter: {
      ...filters,
      variants: { some: { inventoryQuantity: { greaterThan: 0 } } },
    },
    select: {
      id: true,
      title: true,
      body: true,
      handle: true,
      vendor: true,
      variants: { edges: { node: { price: true } } },
    },
  });

  return rawProducts.map((product: any) => ({
    ...product,
    price: product.variants.edges[0]?.node.price || 0,
  }));
};
