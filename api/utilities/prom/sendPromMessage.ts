import { logger } from 'gadget-server';
import { promRequest } from './promClient';
import { ROZETKA_MESSAGE_TEXT } from '../rozetka/sendRozetkaMessage';

// Custom status created in the Prom cabinet (Налаштування → Статуси замовлень)
const CALLBACK_STATUS_TITLE = "Не вдалося зв'язатися";

interface StatusOptionsResponse {
  order_status_options: { id: number; title: string; name: string; type: string }[];
}

let callbackStatusId: number | null = null;

async function getCallbackStatusId(): Promise<number | null> {
  if (callbackStatusId !== null) return callbackStatusId;
  const { order_status_options } = await promRequest<StatusOptionsResponse>('/order_status_options/list');
  const normalize = (s: string) => s.trim().toLowerCase().replace(/[’ʼ`]/g, "'");
  const option = order_status_options.find(
    (o) => o.type === 'custom' && normalize(o.title) === normalize(CALLBACK_STATUS_TITLE)
  );
  callbackStatusId = option?.id ?? null;
  return callbackStatusId;
}

/**
 * Extract the Prom order id from a Shopify order name
 * @param orderName - "P-433965356", or legacy "PROM-433965356"
 */
export function promOrderIdFromName(orderName: string): number | null {
  const match = orderName.trim().match(/^(?:P|PROM)-(\d+)$/);
  return match ? Number(match[1]) : null;
}

/**
 * Message the buyer in Prom chat (with the order card attached) and set the "couldn't reach you" status
 * @returns Promise<boolean> - True if message was sent successfully
 */
export async function sendPromOrderMessage(orderName: string): Promise<boolean> {
  const orderId = promOrderIdFromName(orderName);
  if (!orderId) {
    logger.error({ orderName }, '[Prom] Invalid order name format. Expected format: P-XXXXXXXXX');
    return false;
  }

  try {
    // Docs say multipart, but Prom's gateway rejects it (HTML 400); JSON is what works
    await promRequest('/chat/send_order_context', {
      json: { body: ROZETKA_MESSAGE_TEXT, order_id: orderId },
    });
  } catch (error) {
    logger.error({
      orderId,
      error: error instanceof Error ? error.message : String(error),
    }, '[Prom] Failed to send chat message');
    return false;
  }

  try {
    const statusId = await getCallbackStatusId();
    if (statusId === null) {
      logger.error({ orderId, title: CALLBACK_STATUS_TITLE }, '[Prom] Custom status not found in Prom cabinet');
    } else {
      await promRequest('/orders/set_status', { json: { ids: [orderId], custom_status_id: statusId } });
    }
  } catch (error) {
    logger.error({
      orderId,
      error: error instanceof Error ? error.message : String(error),
    }, '[Prom] Failed to set custom status');
    // Don't throw - message was sent successfully, status change is secondary
  }

  return true;
}
