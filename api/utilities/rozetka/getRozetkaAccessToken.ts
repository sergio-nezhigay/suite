import axios from 'axios';
import { ROZETKA_API_BASE_URL } from '../data/data';

export const getRozetkaAccessToken = async (): Promise<string | null> => {
  console.log('[getRozetkaAccessToken] Starting token request from Rozetka API:', {
    url: `${ROZETKA_API_BASE_URL}/sites`,
    hasUsername: !!process.env.ROZETKA_USERNAME,
    hasPassword: !!process.env.ROZETKA_PASSWORD_BASE64,
    timestamp: new Date().toISOString()
  });

  try {
    const response = await axios.post(
      `${ROZETKA_API_BASE_URL}/sites`,
      {
        username: process.env.ROZETKA_USERNAME,
        password: process.env.ROZETKA_PASSWORD_BASE64,
      },
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    console.log('[getRozetkaAccessToken] Rozetka API response:', {
      success: response.data?.success,
      hasAccessToken: !!response.data?.content?.access_token,
      accessTokenPreview: response.data?.content?.access_token ?
        `${response.data.content.access_token.substring(0, 20)}...` : null,
      responseStatus: response.status,
      message: response.data?.message,
      timestamp: new Date().toISOString()
    });

    if (response.data.success) {
      const token = response.data.content.access_token;
      console.log('[getRozetkaAccessToken] Successfully obtained fresh token from API:', {
        tokenPreview: `${token.substring(0, 20)}...`,
        tokenLength: token.length
      });
      return token;
    } else {
      const errorMsg = 'Failed to get access token' + (response.data.message || '');
      console.error('[getRozetkaAccessToken] API returned unsuccessful response:', {
        success: response.data?.success,
        message: response.data?.message,
        fullResponse: response.data
      });
      throw new Error(errorMsg);
    }
  } catch (error: any) {
    const errorMsg = 'Failed to get access token' + (error.message || '');
    console.error('[getRozetkaAccessToken] Error getting token from API:', {
      error: error.message,
      errorCode: error.code,
      responseStatus: error.response?.status,
      responseData: error.response?.data,
      timestamp: new Date().toISOString()
    });
    throw new Error(errorMsg);
  }
};
