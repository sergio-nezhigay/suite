import { FetchingFunc } from 'api/types';
import { fetchBrainWithRetry } from './fetchBrainWithRetry';

export async function fetchBrain({ query, limit, page }: FetchingFunc) {
  console.log('🚀 ~ fetchBrain:', { query, limit, page });
  const category = '1181';
  const { result } = await fetchBrainWithRetry({
    query,
    category,
    limit,
    page,
  });
  console.log('🚀 ~ data:', result?.list[0]);
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
