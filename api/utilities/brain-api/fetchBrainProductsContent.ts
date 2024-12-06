// http://api.brain.com.ua/products/content/SID [?lang=lang]

import { brainRequest } from './brainRequest';

export async function fetchBrainProductsContent(productIDs: string[]) {
  console.log('🚀 ~ fetchBrainProductsContent:', { productIDs });
  const { result } = await brainRequest({
    url: 'http://api.brain.com.ua/products/content',
    method: 'POST',
    postData: {
      productIDs: productIDs.join(','),
    },
  });

  return { result };
}
