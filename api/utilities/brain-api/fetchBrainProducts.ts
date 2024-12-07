// http://api.brain.com.ua/products/categoryID/SID [?vendorID=vendorID] [&search=search] [&filterID=filterID] [&filters[]=filterID] [&limit=limit] [&offset=offset] [&sortby=field_name] [&order=order] [&lang=lang]

import { FetchingFunc } from 'api/types';
import { brainRequest } from './brainRequest';

import { fetchBrainProductsContent } from './fetchBrainProductsContent';
import { fetchBrainBrands } from './fetchBrainBrands';
import { convertArrayToObject } from './convertArrayToObject';

export async function fetchBrainProducts({ query, limit, page }: FetchingFunc) {
  const categoryID = '1181';

  const { result } = await brainRequest({
    url: `http://api.brain.com.ua/products/${categoryID}`,
    params: {
      search: query,
      limit,
      offset: page,
    },
  });

  const products = result?.list.map((product: any) => ({
    id: product.productID,
    price: product.price,
    name: product.name,
    part_number: product.articul,
    instock: 1,
    warranty: product.warranty,
    vendorID: product.vendorID,
  }));
  const productIDs = products.map(({ id }: { id: string }) => id);
  const extendedProductsContent = await fetchBrainProductsContent(productIDs);
  const productsContent = extendedProductsContent?.result?.list || [];

  const brands = await fetchBrainBrands();
  const mappedProducts = products.map(
    ({ id, vendorID, ...productFields }: { id: string; vendorID: string }) => {
      const vendor = brands.find(
        (brand: { vendorID: string }) => vendorID === brand.vendorID
      );
      const productContent = productsContent.find(
        (product: { productID: string }) => id === product.productID
      );

      const options = convertArrayToObject(productContent?.options || []);
      const description =
        (productContent.brief_description || '') +
        (productContent.description || '');

      const pictures = productContent.images.map(
        (image: { full_image: string; medium_image: string }) => {
          const imageFinal = image?.full_image.includes('no-photo')
            ? image?.medium_image
            : image?.full_image;
          return imageFinal;
        }
      );
      return {
        ...productFields,
        id,
        vendor: vendor?.name,
        description,
        pictures,
        options,
      };
    }
  );

  return { products: mappedProducts, count: products.length };
}
