const mutation = `
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
    }
    userErrors {
      field
      message
    }
  }
}
`;

const variables = {
  input: {
    title: 'title33',
  },
  media: [
    {
      mediaContentType: 'IMAGE',
      originalSource:
        'https://opt.brain.com.ua/static/images/prod_img/8/9/U0572189_big.jpg',
    },
    {
      mediaContentType: 'IMAGE',
      originalSource:
        'https://cdn.shopify.com/s/files/1/0868/0462/7772/files/logitech_b100_910-003357_3.jpg?v=1727796322',
    },
  ],
};

export default async function route({ reply, connections }) {
  try {
    const shopify = await connections.shopify.current;

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
