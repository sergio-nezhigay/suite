import { RouteHandler } from 'gadget-server';

const route: RouteHandler<{ Body: { message: string } }> = async ({
  reply,
  api,
  connections,
  request,
}) => {
  const productId = request?.body?.message || '9708717146428';

  const data = await api.shopifyProduct.findOne(productId, {
    select: {
      title: true,
      body: true,
      vendor: true,
      specificationsType: true,
      specificationsProperties: true,
      specificationsFrequency: true,
      variants: { edges: { node: { price: true, barcode: true } } },
    },
  });

  const product = {
    title: data.title || '',
    body: data.body || '',
    vendor: data.vendor || '',
    barcode: data.variants.edges[0]?.node.barcode || '',
    price: data.variants.edges[0]?.node.price || 0,
    specificationsType: data.specificationsType,
    specificationsProperties: data.specificationsProperties,
    specificationsFrequency: data.specificationsFrequency,
  };

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

  const filteredProducts = products.filter(({ id }) => id !== productId);

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

  await reply.send(finalProducts);
};

export default route;

const stripText = (text: string, termsToRemove: string[]): string =>
  termsToRemove.reduce(
    (str, term) => str.replace(new RegExp(term.toLowerCase(), 'g'), ''),
    text.toLowerCase()
  );

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
      images: { edges: { node: { alt: true, source: true } } },
    },
  });

  return rawProducts.map((product: any) => ({
    ...product,
    price: product.variants.edges[0]?.node.price || 0,
  }));
};

const createEmbedding = async (
  connections: any,
  input: string
): Promise<any> => {
  const { data } = await connections.openai.embeddings.create({
    input,
    model: 'text-embedding-3-small',
  });
  return data[0].embedding;
};
