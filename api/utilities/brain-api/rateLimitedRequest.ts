import { RequestParams } from 'api/types';
import axios from 'axios';
import { api } from 'gadget-server';

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
    return response?.data;
  } catch (error) {
    console.error('Error in rate-limited request:', error);
    throw error;
  }
}
