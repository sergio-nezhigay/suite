import Shopify from 'shopify-api-node';

export async function updateMetafield({
  shopify,
  variables,
}: {
  shopify: Shopify;
  variables?: any;
}) {
  const metafieldMutation = `
          mutation UpdateMetafield($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) {
              metafields {
                id
                value
              }
              userErrors {
                field
                message
              }
            }
          }
        `;

  const response = await shopify.graphql(metafieldMutation, variables);
  if (response.metafieldsSet.userErrors.length > 0) {
    throw new Error(
      `Metafield update failed: ${response.metafieldsSet.userErrors
        .map(
          (error: { field: any; message: any }) =>
            `${error.field}: ${error.message}`
        )
        .join(', ')}`
    );
  }
  return response.metafieldsSet.metafields;
}
