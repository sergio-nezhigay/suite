import { getProducts } from '../utilities/getProducts';
import { uploadFile } from '../utilities/uploadFile';

export default async function route({ request, reply, connections }) {
  try {
    const shopify = connections.shopify.current;

    const products = await getProducts(shopify);

    const productFeed1 = generateSimpleFeed(products);
    const fileContent = products2CSV(productFeed1);
    await uploadFile(shopify, fileContent, 'simple-data.csv');

    return reply.send({ success: true, products });
  } catch (error) {
    console.error('Error generating feed:', error);

    return reply
      .code(500)
      .send({ success: false, message: 'Failed to generate feed' });
  }
}

function generateSimpleFeed(products) {
  return products.map((product) => ({
    id: product?.id,
    title: product?.title,
    vendor: product?.vendor,
    description: product?.description,
    price: product.variants[0].price,
    sku: product?.variants[0].sku,
  }));
}

function products2CSV(productFeed) {
  const headers = Object.keys(productFeed[0]);

  let csvContent = headers.join('\t') + '\n';

  productFeed.forEach((product) => {
    const row = headers.map((header) => product[header] || '').join('\t');
    csvContent += row + '\n';
  });

  return csvContent;
}
