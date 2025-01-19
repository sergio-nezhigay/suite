//http://api.brain.com.ua/product/product_code/product_code/SID [?lang=lang]

import { brainRequest } from 'api/utilities';

export async function fetchBrainProduct(product_code: string) {
  const { result } = await brainRequest({
    url: `http://api.brain.com.ua/product/product_code/${product_code}`,
  });

  return { product: result };
}
