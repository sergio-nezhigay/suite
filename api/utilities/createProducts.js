export default async function createProducts({ shopify, products }) {
  const query = `
      mutation CreateProduct($title: String!, $vendor: String!, $description: String,$media: [CreateMediaInput!]!) {
        productCreate(input: { title: $title, vendor: $vendor, descriptionHtml: $description}) {
          product {
            id
            title
            vendor
            descriptionHtml
          },
          media: media
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
      //  media: ['https://images.prom.ua/1096933532_mini-usb-wi-fi.jpg'],
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
