import { getProducts } from '../utilities/getProducts';
import { uploadFile } from '../utilities/uploadFile';
import { isWeekend } from '../utilities/isWeekEnd';
import { prepareProductDescription } from '../utilities/prepareProductDescription';

export default async function route({ request, reply, connections }) {
  try {
    const shopify = connections.shopify.current;

    const products = await getProducts(shopify);

    const hotlineFeed = generateHotlineFeed(products);
    const hotlineFileContent = products2CSV(hotlineFeed);
    await uploadFile(shopify, hotlineFileContent, 'hotline.csv');

    return reply.send({ success: true, products });
  } catch (error) {
    console.error('Error generating feed:', error);

    return reply
      .code(500)
      .send({ success: false, message: 'Failed to generate feed' });
  }
}

function generateHotlineFeed(products) {
  const basicProductUrl = 'https://byte.com.ua/products/';
  return products.map((product) => {
    const firstVariantWithPrice = product.variants.find(
      (variant) => variant.price
    );
    const firstImageVariant = product.variants.find(
      (variant) => variant.mediaContentType === 'IMAGE'
    );
    const collectionVariant = product.variants.find(
      (variant) =>
        variant?.id && variant.id.startsWith('gid://shopify/Collection/')
    );
    const collectionName = collectionVariant?.title || '';
    const inventoryQuantity = firstVariantWithPrice?.inventoryQuantity;
    const availability = inventoryQuantity > 0 ? 'В наличии' : 'нет в наличии';

    return {
      id: product?.id,
      title: product?.title || '',
      brand: product?.vendor || '',
      warranty: product?.warranty?.value || '',
      rozetka_filter:
        prepareProductDescription(product?.rozetka_filter?.value) || '',
      description: prepareProductDescription(product?.descriptionHtml) || '',
      price: firstVariantWithPrice?.price || '',
      sku: firstVariantWithPrice?.sku || '',
      mpn: firstVariantWithPrice?.barcode || '',
      availability,
      'image link': firstImageVariant?.image?.url || '',
      link: basicProductUrl + product.handle,
      'product type': collectionName,
      'Отгрузка со склада': isWeekend() ? '1' : '0',
    };
  });
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
