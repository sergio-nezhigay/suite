export default async function createProducts({ shopify, products }) {
  const query = `
      mutation CreateProductWithMedia(
      $input: ProductInput!,
      $media: [CreateMediaInput!]!
    )  {
        productCreate(
            input: $input,
            media: $media
        ) {
            product {
            id
            title
            },
            userErrors {
                field
                message
                }
            }
      }
    `;

  if (!shopify) {
    throw new Error('Shopify client is not available.');
  }

  const createdProducts = [];

  for (const product of products) {
    const media = product.pictures.map((picture) => ({
      mediaContentType: 'IMAGE',
      originalSource: picture,
    }));
    const variables = {
      input: {
        title: product.title,
        vendor: product.vendor,
        descriptionHtml: product.description || null,
      },
      media,
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
