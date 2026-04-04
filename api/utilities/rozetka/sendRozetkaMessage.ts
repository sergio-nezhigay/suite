import axios from 'axios';
import { ROZETKA_API_BASE_URL } from '../data/data';
import { rozetkaTokenManager } from './tokenManager';
import { changeRozetkaOrderStatus } from './changeRozetkaOrderStatus';
import { ROZETKA_ORDER_STATUSES } from './rozetkaStatuses';

interface OrderChatResponse {
  success: boolean;
  content: {
    id: number;
    user: {
      id: number;
      has_email: boolean;
      contact_fio: string;
      email: string;
    };
    order_id: number;
  };
}

interface CreateMessageResponse {
  success: boolean;
  content: {
    id: number;
    chat_id: number;
    body: string;
  };
}

const ROZETKA_MESSAGE_TEXT =
  'Не змогли додзвонитись до вас для підтвердження замовлення. Чи актуальне замовлення та указаний номер телефону ?';

/**
 * Get chat information for a Rozetka order
 */
async function getOrderChat(
  orderId: string,
  accessToken: string
): Promise<OrderChatResponse['content'] | null> {
  try {
    const response = await axios.get<OrderChatResponse>(
      `${ROZETKA_API_BASE_URL}/messages/${orderId}/order-chat`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (response.data.success) {
      return response.data.content;
    } else {
      console.error(
        `[Rozetka] Failed to get chat info for order ${orderId}:`,
        response.data
      );
      return null;
    }
  } catch (error) {
    console.error(`[Rozetka] Error getting chat info for order ${orderId}:`, {
      error: error instanceof Error ? error.message : String(error),
      response: axios.isAxiosError(error) ? error.response?.data : undefined,
    });
    return null;
  }
}

/**
 * Send a message to a Rozetka order chat
 */
async function createMessage(
  chatId: number,
  receiverId: number,
  messageText: string,
  accessToken: string
): Promise<boolean> {
  try {
    const response = await axios.post<CreateMessageResponse>(
      `${ROZETKA_API_BASE_URL}/messages/create`,
      {
        body: messageText,
        chat_id: chatId,
        receiver_id: receiverId,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (response.data.success) {
      return true;
    } else {
      console.error(
        `[Rozetka] Failed to send message to chat ${chatId}:`,
        response.data
      );
      return false;
    }
  } catch (error) {
    console.error(`[Rozetka] Error sending message to chat ${chatId}:`, {
      error: error instanceof Error ? error.message : String(error),
      response: axios.isAxiosError(error) ? error.response?.data : undefined,
    });
    return false;
  }
}

/**
 * Send a predefined message to a Rozetka order chat
 * @param orderName - The order name (e.g., "№865770877")
 * @returns Promise<boolean> - True if message was sent successfully
 */
export async function sendRozetkaOrderMessage(
  orderName: string
): Promise<boolean> {
  try {
    // Extract numeric order ID from order name (e.g., "№865770877" -> "865770877")
    const orderIdMatch = orderName.match(/\d{9}/);
    if (!orderIdMatch) {
      console.error(
        `[Rozetka] Invalid order name format: ${orderName}. Expected format: №XXXXXXXXX`
      );
      return false;
    }

    const orderId = orderIdMatch[0];
    // Get access token
    const accessToken = await rozetkaTokenManager.getValidToken();
    if (!accessToken) {
      console.error('[Rozetka] Failed to get access token');
      return false;
    }

    // Get chat information
    const chatInfo = await getOrderChat(orderId, accessToken);
    if (!chatInfo) {
      console.error(`[Rozetka] Failed to get chat info for order ${orderId}`);
      return false;
    }

    // Send message
    const success = await createMessage(
      chatInfo.id,
      chatInfo.user.id,
      ROZETKA_MESSAGE_TEXT,
      accessToken
    );

    if (success) {
      // Change order status to 47 ("Планується повторний дзвінок")
      try {
        await changeRozetkaOrderStatus(
          parseInt(orderId),
          ROZETKA_ORDER_STATUSES.PLANNED_CALLBACK,
          accessToken
        );
      } catch (error) {
        console.error(
          `[Rozetka] Failed to change status to 47 for order ${orderName}:`,
          {
            error: error instanceof Error ? error.message : String(error),
            response: axios.isAxiosError(error) ? error.response?.data : undefined,
          }
        );
        // Don't throw - message was sent successfully, status change is secondary
      }
    }

    return success;
  } catch (error) {
    console.error(`[Rozetka] Error in sendRozetkaOrderMessage:`, {
      orderName,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
