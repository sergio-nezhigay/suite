// http://api.brain.com.ua/vendors/[categoryID/]SID

import { brainRequest } from 'api/utilities';

export async function fetchBrainBrands() {
  const { status, result } = await brainRequest({
    url: `http://api.brain.com.ua/vendors`,
  });
  if (status !== 1) {
    throw Error('fetchBrainBrands error');
  }
  return result;
}
