import { getSID } from './getSID';
import { rateLimitedRequest } from './rateLimitedRequest';

interface RequestParams {
  [key: string]: any;
  sid?: string;
}

interface ResponseData {
  error_message?: string;
  [key: string]: any;
}

export async function brainRequest(
  url: string,
  params: RequestParams = {}
): Promise<ResponseData> {
  let sid: string = await getSID();
  let attempts: number = 0;
  const MAX_RETRIES: number = 2;

  while (attempts < MAX_RETRIES) {
    try {
      params.sid = sid;
      const response: ResponseData = await rateLimitedRequest(url, params);
      console.log('🚀 ~ response:', response);

      if (
        response.error_message &&
        response.error_message.includes('Session identifier')
      ) {
        console.log('🚀 ~need to refresh session identifier');
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
