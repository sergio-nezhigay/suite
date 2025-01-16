import { RouteHandler } from 'gadget-server';

// Utility function to clean up product text
const stripText = (text: string, termsToRemove: string[]): string => {
  let strippedText = text.toLowerCase();
  for (const term of termsToRemove) {
    strippedText = strippedText.replace(
      new RegExp(term.toLowerCase(), 'g'),
      ''
    );
  }
  return strippedText;
};

const filterProducts = (products, priceRef, productId, koeff) => {
  console.log(
    'Initial products (title and price):',
    products.map(({ title, price }) => ({ title, price }))
  );
  console.log('Reference price:', priceRef);
  console.log('Filtering products based on price > 90% of reference price...');

  const filteredByPrice = products.filter(({ price }) => {
    const isAbovePrice = Number(price) > Number(priceRef) * koeff;
    console.log(`Product price: ${price}, Filtered: ${isAbovePrice}`);
    return isAbovePrice;
  });

  console.log(
    'Filtered by price > 90% of reference:',
    filteredByPrice.map(({ title, price }) => ({ title, price }))
  );

  const finalFilteredProducts = filteredByPrice.filter(
    ({ id }) => id !== productId
  );
  console.log(
    'Final filtered products (excluding productId):',
    finalFilteredProducts.map(({ title, price }) => ({ title, price }))
  );

  return finalFilteredProducts;
};

// Utility function to fetch products with specified filters
const fetchProducts = async (api, embedding, filters = {}, limit = 10) => {
  const rawProducts = await api.shopifyProduct.findMany({
    sort: {
      descriptionEmbedding: { cosineSimilarityTo: embedding },
    },
    first: limit,
    filter: {
      ...filters,
      variants: {
        some: { inventoryQuantity: { greaterThan: 0 } },
      },
    },
    select: {
      id: true,
      title: true,
      body: true,
      handle: true,
      variants: {
        edges: {
          node: { price: true },
        },
      },
      images: {
        edges: {
          node: { alt: true, source: true },
        },
      },
    },
  });

  return rawProducts.map((productItem) => ({
    ...productItem,
    images:
      productItem.images.edges.length > 0
        ? [productItem.images.edges[0].node]
        : [],
    price:
      productItem.variants.edges.length > 0
        ? productItem.variants.edges[0].node.price
        : 0,
  }));
};

// Utility function to create an embedding
const createEmbedding = async (connections, input) => {
  const response = await connections.openai.embeddings.create({
    input,
    model: 'text-embedding-3-small',
  });
  return response.data[0].embedding;
};

// Main route handler
const route: RouteHandler<{
  Body: { message: string };
}> = async ({ reply, api, connections, request }) => {
  const productId = request?.body?.message || '9708717146428';

  // Fetch product details
  const data = await api.shopifyProduct.findOne(productId, {
    select: {
      title: true,
      body: true,
      vendor: true,
      specificationsType: true,
      specificationsProperties: true,
      specificationsFrequency: true,
      variants: {
        edges: {
          node: {
            price: true,
            barcode: true,
          },
        },
      },
    },
  });

  const product = {
    body: data.body || '',
    title: data.title || '',
    vendor: data.vendor || '',
    barcode: data.variants.edges[0]?.node.barcode || '',
    price: data.variants.edges[0]?.node.price || 0,
    specificationsType: data.specificationsType,
    specificationsProperties: data.specificationsProperties,
    specificationsFrequency: data.specificationsFrequency,
  };

  const termsToRemove = [product.barcode, product.vendor];
  const input =
    stripText(product.title, termsToRemove) +
    stripText(product.body, termsToRemove);

  const embedding = await createEmbedding(connections, input);

  const vendorFilters = {
    specificationsType: { equals: product.specificationsType },
    specificationsProperties: { equals: product.specificationsProperties },
    specificationsFrequency: { equals: product.specificationsFrequency },
    vendor: { equals: product.vendor },
  };
  const productsWithVendor = await fetchProducts(api, embedding, vendorFilters);

  const productsWithVendorFiltered2 = filterProducts(
    productsWithVendor,
    product.price,
    productId,
    0.8
  );

  const generalFilters = {
    specificationsType: { equals: product.specificationsType },
    specificationsProperties: { equals: product.specificationsProperties },
    specificationsFrequency: { equals: product.specificationsFrequency },
  };
  const productsWithoutVendor = await fetchProducts(
    api,
    embedding,
    generalFilters
  );

  const filteredNonBrandedProducts2 = filterProducts(
    productsWithoutVendor,
    product.price,
    productId,
    0.7
  );

  let finalProducts = productsWithVendorFiltered2.slice(0, 10);
  const productsNeeded = 10 - finalProducts.length;

  if (productsNeeded > 0) {
    const additionalProducts = filteredNonBrandedProducts2
      .filter((prod) => !finalProducts.some((p) => p.id === prod.id))
      .slice(0, productsNeeded);
    finalProducts = [...finalProducts, ...additionalProducts];
  }

  // Send response
  await reply.send(finalProducts);
};

export default route;
