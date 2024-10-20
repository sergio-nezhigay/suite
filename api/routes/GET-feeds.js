import { getProducts } from '../utilities/getProducts';
import { uploadFile } from '../utilities/uploadFile';
import { isWeekend } from '../utilities/isWeekEnd';
import { prepareProductDescription } from '../utilities/prepareProductDescription';

export default async function route({ request, reply, connections }) {
  try {
    const shopify = connections.shopify.current;

    const products = await getProducts(shopify);

    const genericFeed = generateGenericFeed(products);
    const hotlineFeed = generateHotlineFeed(genericFeed);
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

function generateGenericFeed(products) {
  const basicProductUrl = 'https://byte.com.ua/products/';
  return products
    .map((product) => {
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
      const availability = inventoryQuantity > 0 ? 'in stock' : 'out-of-stock';

      return {
        id: product?.id,
        title: product?.title || '',
        brand: product?.vendor || '',
        warranty: product?.warranty?.value || '',
        rozetka_tag: product?.rozetka_tag?.value || '',
        rozetka_filter:
          prepareProductDescription(product?.rozetka_filter?.value) || '',
        description: prepareProductDescription(product?.descriptionHtml) || '',
        price: Math.floor(firstVariantWithPrice?.price ?? 0),
        sku: firstVariantWithPrice?.sku || '',
        mpn: firstVariantWithPrice?.barcode || '',
        availability,
        image: firstImageVariant?.image?.url || '',
        link: basicProductUrl + product.handle,
        collection: collectionName,
        delivery_days: isWeekend() ? '1' : '0',
      };
    })
    .filter(({ availability }) => availability === 'in stock');
}
const generateHotlineFeed = (products) => {
  return products.map((product) => ({
    id: product.id,
    title: product.title,
    brand: product.brand,
    warranty: product.warranty,
    description: product.description,
    price: product.price,
    mpn: product.mpn,
    availability:
      product.availability === 'in stock' ? 'В наличии' : 'нет в наличии',
    'image link': product.image,
    link:
      product.link + '/?utm_source=hotline&utm_medium=cpc&utm_campaign=hotline',
    'product type': product.collection,
    'Отгрузка со склада': product.delivery_days,
  }));
};
const generateMerchantFeed = (products) => {
  return products.map((product) => {
    const supplier = product.sku?.split('^')[1] ?? '';
    return {
      id: product.id,
      title: product.title,
      description: product.description,
      link:
        product.link +
        '/?utm_source=google&utm_medium=cpc&utm_campaign=merchant',
      'image link': product.image,
      availability: product.availability,
      price: product.price + ' UAH',
      brand: product.brand,
      'item group id': product.rozetka_tag || product.collection,
      'product type': product.collection,
      condition: 'new',
      'custom label 1': product.collection,
      'custom label 2': supplier,
      'custom label 3': `${supplier}:product.collection`,
      'store code': '101',
      mpn: product.mpn,
      warranty: product.warranty,
      sku: product.sku,
      'identifier exists': 'no',
    };
  });
};

function products2CSV(productFeed) {
  const headers = Object.keys(productFeed[0]);

  let csvContent = headers.join('\t') + '\n';

  productFeed.forEach((product) => {
    const row = headers.map((header) => product[header] || '').join('\t');
    csvContent += row + '\n';
  });

  return csvContent;
}
