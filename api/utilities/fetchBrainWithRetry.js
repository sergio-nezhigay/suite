import { fetchBrainProducts } from './fetchBrainProducts';
import { getSid } from './getSid';

export async function fetchBrainWithRetry(category, sid, limit, page) {
  let data = await fetchBrainProducts(category, sid, limit, page);

  if (isValidResponse(data)) {
    return data;
  }

  if (data.error_message?.includes('Session identifier')) {
    const newSid = await getSid();
    data = await fetchBrainProducts(category, newSid, limit, page);

    if (isValidResponse(data)) {
      return data;
    }
  }

  throw new Error('Failed to fetch valid data');
}

function isValidResponse(data) {
  return data?.status === 1 && data?.result?.list;
}
