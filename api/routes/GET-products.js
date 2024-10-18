export default async function route({ request, reply, connections }) {
  const shopify = connections.shopify.current;

  const products = await shopify.graphql(
    `query {
        products(first: 10) {
          edges {
            node {
              id
              title
              handle
            }
            cursor
          }
          pageInfo {
            hasNextPage
          }
        }
      }`
  );

  await reply.send({
    products,
  });
}
