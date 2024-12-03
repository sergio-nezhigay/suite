import { FetchingFunc } from 'api/types';

import { fetchBrainWithRetry } from '../utilities';

export async function fetchBrain({ query, limit, page }: FetchingFunc) {
  console.log('🚀 ~ fetchBrain:', { query, limit, page });
  const category = '1181';
  const sid = '';
  const data = await fetchBrainWithRetry(category, sid, limit, page);
  console.log('🚀 ~ data:', data);
  return { products: [], count: 0 };
}
