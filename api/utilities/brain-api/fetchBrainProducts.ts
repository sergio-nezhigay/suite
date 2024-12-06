// http://api.brain.com.ua/products/categoryID/SID [?vendorID=vendorID] [&search=search] [&filterID=filterID] [&filters[]=filterID] [&limit=limit] [&offset=offset] [&sortby=field_name] [&order=order] [&lang=lang]

import { FetchingFunc } from 'api/types';
import { brainRequest } from './brainRequest';
import { fetchBrainProduct } from './fetchBrainProduct';
import { fetchBrainProductsPictures } from './fetchBrainProductsPictures';

export async function fetchBrainProducts({ query, limit, page }: FetchingFunc) {
  console.log('🚀 ~ fetchBrainProducts:', { query, limit, page });
  const categoryID = '1181';
  const fetchUrl = `http://api.brain.com.ua/products/${categoryID}`;
  const { result } = await brainRequest(fetchUrl, {
    searchString: query,
    limit,
    offset: page,
  });

  const products = result?.list.map((product: any) => {
    const pictures = product?.large_image ? [product?.large_image] : [];
    return {
      id: product.productID,
      price: product.price,
      name: product.name,
      description: product.brief_description,
      pictures: pictures,
      part_number: product.articul,
      vendor: 'Test',
      instock: 0,
      warranty: product.warranty,
    };
  });
  //  const test = fetchBrainProduct(products[0].part_number);
  //  console.log('🚀 ~ test:', test);

  //  const pics = await fetchBrainProductsPictures({ query, limit, page });

  //  console.log(
  //    '===== LOG START =====',
  //    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  //  );
  //  console.log('pics:', JSON.stringify(pics, null, 4));

  return { products: products, count: products.length };
}
