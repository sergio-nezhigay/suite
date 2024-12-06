// http://api.brain.com.ua/product/articul/articul/SID [?lang=lang]

import { brainRequest } from './brainRequest';

export async function fetchBrainProduct(articul: string) {
  const fetchUrl = `http://api.brain.com.ua/product/articul/${articul}`;
  const { result } = await brainRequest(fetchUrl);
  return { product: result };
}
