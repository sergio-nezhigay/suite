export async function getProducts(shopify, fileName) {
  const fileQuery = `{
      files(first: 1, query: "filename:${fileName}") {
        edges {
          node {
            id
            alt
          }
        }
      }
    }`;
  const response = await shopify.graphql(fileQuery);
  return response?.files?.edges[0]?.node;
}
