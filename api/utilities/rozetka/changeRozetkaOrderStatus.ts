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

    if (response.data.success) {
      console.log(
        `Status updated to ${status} for Rozetka order ${orderId}` +
          (ttn ? ` with TTN ${ttn}` : '')
      );
    } else {
      console.error(`Failed to update status for order ${orderId}`);
    }
  } catch (error) {
    console.error(`Error updating status for order ${orderId}:`, error);
  }
};
