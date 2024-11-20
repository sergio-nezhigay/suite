export default async function createProduct({ shopify, title, vendor }) {
  const query = `
      mutation CreateProduct(
        $title: String!,
        $vendor: String!
      ) {
        productCreate(
          input: {
            title: $title,
            vendor: $vendor
          }
        ) {
          product {
            id
            title
            vendor
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

  const variables = {
    title,
    vendor,
  };

  try {
    if (!shopify || !shopify.graphql) {
      throw new Error('Shopify object or GraphQL client is not available.');
    }

    const response = await shopify.graphql(query, variables);

    if (response.productCreate.userErrors.length > 0) {
      return {
        error: response.productCreate.userErrors,
      };
    }

    return {
      product: response.productCreate.product,
    };
  } catch (error) {
    console.error('Error creating product:', error);
    return {
      error: error.message,
    };
  }
}
