import axios from 'axios';

export const BASE_URL = 'https://api-seller.rozetka.com.ua';

export async function getAccessToken() {
  try {
    const response = await axios.post(
      `${BASE_URL}/sites`,
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
        response.data.errors.message || 'Failed to get access token'
      );
    }
  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
    return null;
  }
}
