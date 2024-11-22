import { RouteContext } from 'gadget-server';

export default async function route({ reply, connections }) {
  const title = 'Test'; // Constant title for the product

  try {
    const shopify = await connections.shopify.current;

    const mutation = `#graphql
      mutation CreateProduct($title: String!) {
        productCreate(input: { title: $title }) {
          product {
            id
            title
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = { title };
    const response = await shopify.graphql(mutation, variables);

    if (response.productCreate.userErrors.length > 0) {
      return reply
        .code(400)
        .send({ errors: response.productCreate.userErrors });
    }

    return reply.code(200).send({ product: response.productCreate.product });
  } catch (error) {
    return reply.code(500).send({ error: error.message });
  }
}
