//http://api.brain.com.ua/product/product_code/product_code/SID [?lang=lang]

import { brainRequest } from './brainRequest';

export async function fetchBrainProduct(product_code: string) {
  const { result } = await brainRequest({
    url: `http://api.brain.com.ua/product/product_code/${product_code}`,
  });

  return { product: result };
}
//export async function fetchBrainProduct(articul: string) {
//  const { result } = await brainRequest({
//    url: `http://api.brain.com.ua/product/articul/${articul}`,
//  });

//  return { product: result };
//}
