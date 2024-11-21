export default async function createProducts({ shopify, products }) {
  const query = `
      mutation CreateProduct($title: String!, $vendor: String!, $description: String) {
        productCreate(input: { title: $title, vendor: $vendor, descriptionHtml: $description }) {
          product {
            id
            title
            vendor
            descriptionHtml
          }
        }
      }
    `;

  if (!shopify || !shopify.graphql) {
    throw new Error('Shopify client is not available.');
  }

  const createdProducts = [];

  for (const product of products) {
    const variables = {
      title: product.title,
      vendor: product.vendor,
      description: product.description || null,
    };

    const response = await shopify.graphql(query, variables);

    if (!response?.productCreate?.product) {
      throw new Error('Failed to create one or more products.');
    }

    createdProducts.push(response.productCreate.product);
  }

  return {
    message: 'Products created successfully',
    createdProducts,
  };
}
