import { FetchingFunc } from 'api/types';
import { brainRequest } from './brainRequest';

export async function fetchBrainProducts({ query, limit, page }: FetchingFunc) {
  console.log('🚀 ~ fetchBrainProducts:', { query, limit, page });
  const category = '1181';
  const fetchUrl = `http://api.brain.com.ua/products/${category}`;
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
  return { products: products, count: products.length };
}
