// http://api.brain.com.ua/products/categoryID/SID [?vendorID=vendorID] [&search=search] [&filterID=filterID] [&filters[]=filterID] [&limit=limit] [&offset=offset] [&sortby=field_name] [&order=order] [&lang=lang]

import { FetchingFunc } from 'api/types';
import {
  brainRequest,
  fetchBrainProductsContent,
  fetchBrainBrands,
  convertArrayToObject,
  fetchBrainProduct,
} from 'api/utilities';

export async function fetchBrainProducts({
  query,
  limit,
  page,
  categoryId,
}: FetchingFunc) {
  let products = [],
    count = 0;
  const offset = page ? +page - 1 : 0;
  try {
    const { result, status, error_message } = await brainRequest({
      url: `http://api.brain.com.ua/products/${categoryId}`,
      params: {
        search: query,
        limit,
        offset,
      },
    });
    if (status === 0) {
      throw Error(error_message);
    }
    if (result?.count) {
      count = +result?.count;
    }

    products = result?.list;

    if (!count && isValidArticul(query)) {
      const data = await fetchBrainProduct(query);

      const product = data?.product;
      if (
        product &&
        (product?.stocks.length > 0 ||
          (product?.stocks_expected &&
            Object.keys(product.stocks_expected).length > 0))
      ) {
        products.push(product);
        count = 1;
      }
    }

    const productIDs = products.map(
      ({ productID }: { productID: string }) => productID
    );
    const extendedProductsContent = await fetchBrainProductsContent(productIDs);
    const productsContent = extendedProductsContent?.result?.list || [];

    const brands = await fetchBrainBrands();
    const mappedProducts = products.map(
      ({
        productID,
        articul,
        vendorID,
        name,
        retail_price_uah,
        warranty,
        stocks,
        stocks_expected,
      }: {
        productID: string;
        articul: string;
        vendorID: string;
        name: string;
        retail_price_uah: string;
        warranty: string;
        stocks: string[];
        stocks_expected:
          | any[]
          | {
              [key: string]: string;
            };
      }) => {
        const vendor = brands.find(
          (brand: { vendorID: string }) => vendorID == brand.vendorID
        );
        const productContent = productsContent.find(
          (product: { productID: string }) => productID == product.productID
        );

        const options = convertArrayToObject(productContent?.options || []);
        const description =
          (productContent?.brief_description || '') +
          (productContent?.description || '');

        const pictures = productContent?.images.map(
          (image: { full_image: string; medium_image: string }) => {
            const imageFinal = image?.full_image.includes('no-photo')
              ? image?.medium_image
              : image?.full_image;
            return imageFinal;
          }
        );
        return {
          name,
          id: productID,
          vendor: vendor?.name,
          description,
          pictures,
          options,
          price: retail_price_uah,
          warranty,
          part_number: articul,
          instock:
            stocks.length > 0 || Object.keys(stocks_expected).length > 0
              ? 5
              : 0,
        };
      }
    );

    return { products: mappedProducts, count };
  } catch (error) {
    console.log('error:', error);
    return { products: [], count: 0, error: error };
  }
}

function isValidArticul(articul: string) {
  if (!articul) return false;
  const regex = /^[a-zA-Z0-9-]+$/;
  return regex.test(articul);
}
