import axios from 'axios';
import { BASE_URL, getAccessToken } from './getAccessToken';

const ORDER_TYPES = {
  ALL: '1',
  PROCESSING: '2',
  COMPLETED: '3',
  NEW: '4',
  SHIPPING: '5',
};

export const run: ActionRun = async ({ params, logger, api, connections }) => {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    console.error('No access token available');
    return;
  }

  const ORDERS_URL = `${BASE_URL}/orders/search`;

  try {
    const response = await axios.get(ORDERS_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      params: {
        types: ORDER_TYPES.ALL,
      },
    });

    if (response.data.success) {
      const orders = response.data.content.orders;
      console.log('New Orders:', orders);
      return orders;
    } else {
      throw new Error(
        response.data.errors.message || 'Failed to get access orders'
      );
    }
  } catch (error) {
    console.error('Error fetching orders:', error);
    return null;
  }
};

export const options = {
  triggers: {
    scheduler: [
      { every: "day", at: "12:20 UTC" },
    ],
  },
};
