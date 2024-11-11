import { getProducts } from '../utilities/getProducts';
import { uploadFile } from '../utilities/uploadFile';
import { isWeekend } from '../utilities/isWeekEnd';
import { prepareProductDescription } from '../utilities/prepareProductDescription';
import { makeRozetkaFeed } from '../utilities/makeRozetkaFeed';
const genericSuppliers = ['щу', 'ии', 'ри', 'че', 'ме', 'б'];

const IN_STOCK = 'in stock';
const OUT_OF_STOCK = 'out-of-stock';

export default async function route({ request, reply, connections }) {
  try {
    const shopify = connections.shopify.current;

    const products = await getProducts(shopify);

    const genericFeed = makeGenericFeed(products);

    const hotlineFeed = makeHotlineFeed(genericFeed);

    const hotlineFileContent = products2CSV(hotlineFeed);

    await uploadFile(shopify, hotlineFileContent, 'hotline.csv');
    const merchantFeed = makeMerchantFeed(genericFeed);
    const merchantFileContent = products2CSV(merchantFeed);
    await uploadFile(shopify, merchantFileContent, 'merchantfeed1.csv');
    const remarketingFeed = makeRemarketingFeed(genericFeed);
    const remarketingFileContent = products2CSV(remarketingFeed);
    await uploadFile(shopify, remarketingFileContent, 'remarketing.csv');

    const rozetkaFeedContent = makeRozetkaFeed(genericFeed);
    await uploadFile(shopify, rozetkaFeedContent, 'rozetkaFeed.xml');

    return reply.send({ success: true, products });
  } catch (error) {
    console.error('Error generating feed:', error);

    return reply
      .code(500)
      .send({ success: false, message: 'Failed to make feed' });
  }
}

function makeGenericFeed(products) {
  const basicProductUrl = 'https://informatica.com.ua/products/';
  return products
    .map((product) => {
      const firstVariantWithPrice = product.variants.find(
        (variant) => variant.price
      );
      const firstImageVariant = product.variants.find(
        (variant) => variant.mediaContentType === 'IMAGE'
      );
      const imageURLs = product.variants
        .filter((variant) => variant.mediaContentType === 'IMAGE')
        .map((variant) => variant.image.url);
      const collectionVariant = product.variants.find(
        (variant) =>
          variant?.id && variant.id.startsWith('gid://shopify/Collection/')
      );
      const collectionName = collectionVariant?.title || '';
      const inventoryQuantity = firstVariantWithPrice?.inventoryQuantity;
      const availability = inventoryQuantity > 0 ? IN_STOCK : OUT_OF_STOCK;

      return {
        id: product?.id,
        id_woocommerce: product?.id_woocommerce?.value || '',
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
        inventoryQuantity,
        availability,
        imageURLs,
        link: basicProductUrl + product.handle,
        collection: collectionName,
        delivery_days: isWeekend() ? '1' : '0',
      };
    })
    .filter(({ availability, sku }) => {
      const supplier = sku.split('^')[1] || '';
      return (
        availability === IN_STOCK &&
        genericSuppliers.includes(supplier.toLowerCase())
      );
    });
}
const makeHotlineFeed = (products) => {
  return products.map((product) => ({
    'id товару': product.id.replace(/\D/g, ''),
    'Назва товару': product.title,
    description: product.description,
    URL:
      product.link + '/?utm_source=hotline&utm_medium=cpc&utm_campaign=hotline',
    Грн: product.price,
    'image link': product.imageURLs.length > 0 && product.imageURLs[0],
    'Категорія товару': product.collection,
    Shipping: product.delivery_days,
    Виробник: product.brand,
    'Доступність товару':
      product.availability === IN_STOCK ? 'В наличии' : 'нет в наличии',
    Гарантія: product.warranty,
    'Код товару': product.mpn,
  }));
};

const makeMerchantFeed = (products) => {
  return products.map((product) => {
    const supplier = product.sku?.split('^')[1] ?? '';
    const additionalImageLinks = product.imageURLs.slice(1, 11).length
      ? `"${product.imageURLs.slice(1, 11).join(',')}"`
      : '';

    return {
      id: product.id,
      title: product.title,
      description: product.description,
      link: `${product.link}/?utm_source=google&utm_medium=cpc&utm_campaign=merchant`,
      'image link': product.imageURLs[0] || '',
      additional_image_link: additionalImageLinks,
      availability: product.availability,
      price: `${product.price} UAH`,
      brand: product.brand,
      'item group id': product.rozetka_tag || product.collection,
      'product type': product.collection,
      condition: 'new',
      'custom label 1': product.collection,
      'custom label 2': supplier,
      'custom label 3': `${supplier}:${product.collection}`,
      'store code': '101',
      mpn: product.mpn,
      'identifier exists': 'no',
    };
  });
};

const makeRemarketingFeed = (products) => {
  return products.map((product) => ({
    ID: product.id,
    'Item title': product.title,
    'Final URL': `${product.link}/?utm_source=google&utm_medium=cpc&utm_campaign=googleremarketing`,
    'Image URL': product.imageURLs[0] || '',
    'Item category': product.collection,
  }));
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
