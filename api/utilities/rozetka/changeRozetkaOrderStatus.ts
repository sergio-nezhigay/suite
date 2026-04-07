import axios from 'axios';
import { ROZETKA_API_BASE_URL } from '../data/data';

export const changeRozetkaOrderStatus = async (
  orderId: number,
  status: number,
  accessToken: string,
  ttn?: string
): Promise<void> => {
  try {
    const body: any = { status };
    if (ttn) {
      body.ttn = ttn;
    }

    const response = await axios.put(
      `${ROZETKA_API_BASE_URL}/orders/${orderId}`,
      body,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`Rozetka response for order ${orderId}:`, JSON.stringify(response.data, null, 2));

    if (!response.data.success) {
      throw new Error(`Failed to update Rozetka status for order ${orderId}. Response: ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    console.error(`Error updating status for order ${orderId}:`, error);
    throw error;
  }
};
