export const run = async ({ logger, connections }) => {
  const shopify = connections.shopify.;
  if (!shopify) {
    throw new Error('Missing Shopify connection');
  }

  const product = await shopify.graphql(
    `mutation ($input: ProductInput!) {
        productCreate(input: $input) {
          product {
            title
          }
        }
        userErrors {
          message
        }
      }`,
    {
      input: {
        title: 'New Product',
      },
    }
  );
  logger.info({ product }, 'created new product in Shopify');
  return product;
};
