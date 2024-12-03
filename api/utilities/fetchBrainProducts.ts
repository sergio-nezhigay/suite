import { BrainFetch } from 'api/types';

export default async function fetchBrainProducts({
  category,
  sid,
  limit,
  page,
}: BrainFetch) {
  if (!sid) {
    throw new Error(
      `Session identifier: no SID provided at fetchBrainProducts`
    );
  }

  const fetchUrl = `http://api.brain.com.ua/products/${category}/${sid}?&limit=${limit}&offset=${page}`;
  console.log('🚀 ~ fetchUrl:', fetchUrl);
  const response = await fetch(fetchUrl);
  console.log('🚀 ~ response:', response);

  if (!response.ok) {
    throw new Error(
      `Fetch failed: ${response.status} - ${await response.text()}`
    );
  }
  const result = await response.json();
  console.log('🚀 ~ result:', result);
  return result;
}
