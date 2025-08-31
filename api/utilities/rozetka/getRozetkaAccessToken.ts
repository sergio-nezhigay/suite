import axios from 'axios';
import { ROZETKA_API_BASE_URL } from '../data/data';

export const getRozetkaAccessToken = async (): Promise<string | null> => {
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

    if (response.data.success) {
      return response.data.content.access_token;
    } else {
      throw new Error(
        'Failed to get access token' + (response.data.message || '')
      );
    }
  } catch (error: any) {
    throw new Error('Failed to get access token' + (error.message || ''));
  }
};
