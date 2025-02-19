import axios from 'axios';
import { api } from 'gadget-server';

import { RequestParams } from 'api/types';

const MAX_REQUESTS_PER_SECOND = 3;
const TIME_INTERVAL = 1000 / MAX_REQUESTS_PER_SECOND;

export async function rateLimitedRequest({
  url,
  params = {},
  method = 'GET',
  postData = {},
}: RequestParams) {
  const { sid, ...queryParams } = params;
  const fullPath = sid ? `${url}/${sid}` : url;

  const urlObj = new URL(fullPath);
  const searchParams = new URLSearchParams(queryParams);
  if (method === 'GET') urlObj.search = searchParams.toString();

  const brainSession = await api.brainSession.findFirst();
  if (!brainSession.lastRequestTime)
    throw new Error(`Failed to get lastRequestTime from db`);
  const lastRequestTime = new Date(brainSession.lastRequestTime).getTime();
  const currentTime = Date.now();

  if (lastRequestTime && currentTime - lastRequestTime < TIME_INTERVAL) {
    const delay = TIME_INTERVAL - (currentTime - lastRequestTime);
    console.log(`Rate-limited. Waiting ${delay} ms`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  console.log(
    '===== LOG START =====',
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );
  console.log('rateLimitedRequest urlObj:', JSON.stringify(urlObj, null, 4));
  try {
    let response;
    if (method === 'GET') {
      response = await axios.get(urlObj.toString(), { params });
    } else if (method === 'POST') {
      response = await axios.post(urlObj.toString(), postData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
    }
    await api.brainSession.update(brainSession.id, {
      lastRequestTime: new Date(currentTime),
    });

    if (response?.data?.status === '0') {
      if (response?.data?.error_code === 'Incorrect product')
        return { product: null };
      else {
        throw Error('Brain error' + response?.data?.error_code || '');
      }
    }

    return response?.data;
  } catch (error) {
    console.error('Error in rate-limited request:', error);
    throw error;
  }
}
