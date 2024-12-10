// http://api.brain.com.ua/products/categoryID/SID [?vendorID=vendorID] [&search=search] [&filterID=filterID] [&filters[]=filterID] [&limit=limit] [&offset=offset] [&sortby=field_name] [&order=order] [&lang=lang]

import { FetchingFunc } from 'api/types';
import { brainRequest } from './brainRequest';

import { fetchBrainProductsContent } from './fetchBrainProductsContent';
import { fetchBrainBrands } from './fetchBrainBrands';
import { convertArrayToObject } from './convertArrayToObject';
import { fetchBrainProduct } from './fetchBrainProduct';

export async function fetchBrainProducts({
  query,
  limit,
  page,
  categoryId,
}: FetchingFunc) {
  let products = [];
  try {
    const { result } = await brainRequest({
      url: `http://api.brain.com.ua/products/${categoryId}`,
      params: {
        search: query,
        limit,
        offset: page,
      },
    });

    products = result?.list.filter(
      ({ stocks }: { stocks: any[] }) => stocks.length > 0
    );
    if (products.length === 0) {
      const { product } = await fetchBrainProduct(query);
      if (
        product.stocks.length > 0 ||
        Object.keys(product.stocks_expected).length > 0
      ) {
        products.push(product);
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
        vendorID,
        name,
        retail_price_uah,
        warranty,
      }: {
        productID: string;
        vendorID: string;
        name: string;
        retail_price_uah: string;
        warranty: string;
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
        };
      }
    );

    return { products: mappedProducts, count: products.length };
  } catch (error) {
    console.log('error:', JSON.stringify(error, null, 4));
  }
}
