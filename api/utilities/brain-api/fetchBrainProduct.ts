// http://api.brain.com.ua/product/articul/articul/SID [?lang=lang]

import { brainRequest } from './brainRequest';

export async function fetchBrainProduct(articul: string) {
  const { result } = await brainRequest({
    url: `http://api.brain.com.ua/product/articul/${articul}`,
  });
  return { product: result };
}
