import axios from 'axios';
import { logger } from 'gadget-server';
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

    logger.info({ orderId, data: response.data }, 'Rozetka response');

    if (!response.data.success) {
      throw new Error(`Failed to update Rozetka status for order ${orderId}. Response: ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    logger.error({ orderId, err: error }, 'Error updating status for order');
    throw error;
  }
};
