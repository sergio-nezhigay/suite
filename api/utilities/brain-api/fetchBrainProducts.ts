import { BrainFetch } from 'api/types';

export default async function fetchBrainProducts({
  query,
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
  const searchString = query ? `&search=${query}` : '';
  const fetchUrl = `http://api.brain.com.ua/products/${category}/${sid}?${searchString}&limit=${limit}&offset=${page}`;

  const response = await fetch(fetchUrl);

  if (!response.ok) {
    throw new Error(
      `Fetch failed: ${response.status} - ${await response.text()}`
    );
  }
  const result = await response.json();
  return result;
}
