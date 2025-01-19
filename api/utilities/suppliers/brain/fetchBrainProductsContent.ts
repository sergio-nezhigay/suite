// http://api.brain.com.ua/products/content/SID [?lang=lang]

import { brainRequest } from 'api/utilities';

export async function fetchBrainProductsContent(productIDs: string[]) {
  const { result } = await brainRequest({
    url: 'http://api.brain.com.ua/products/content',
    method: 'POST',
    postData: {
      productIDs: productIDs.join(','),
    },
  });

  return { result };
}
