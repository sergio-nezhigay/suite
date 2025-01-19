import { RequestParams } from 'api/types';
import { getSID, rateLimitedRequest } from 'api/utilities';

interface ResponseData {
  error_message?: string;
  [key: string]: any;
}

export async function brainRequest({
  url,
  params = {},
  method = 'GET',
  postData = {},
}: RequestParams): Promise<ResponseData> {
  let sid: string = await getSID();
  let attempts: number = 0;
  const MAX_RETRIES: number = 2;

  while (attempts < MAX_RETRIES) {
    try {
      params.sid = sid;
      const response: ResponseData = await rateLimitedRequest({
        url,
        params,
        method,
        postData,
      });

      if (
        response.error_message &&
        response.error_message.includes('Session identifier')
      ) {
        sid = await getSID({ refresh: true });
        attempts++;
        continue;
      }

      return response;
    } catch (error: any) {
      console.error(`Request to ${url} failed: ${error.message}`);
      throw error;
    }
  }

  throw new Error('Max retries reached for request due to session issues.');
}
