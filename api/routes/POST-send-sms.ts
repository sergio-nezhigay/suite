import type { RouteHandler } from 'fastify';
import { smsClient } from 'utilities';
import { sendRozetkaOrderMessage } from '../utilities/rozetka/sendRozetkaMessage';

const route: RouteHandler = async (request, reply) => {
  const { to, message, orderName } = request.body as {
    to: string;
    message: string;
    orderName?: string;
  };
  if (!to || !message) {
    return await reply
      .status(400)
      .send({ error: '`to` and `message` parameters are required' });
  }

  try {
    const smsResponse = await smsClient(to, message);
    // Check if we should send a Rozetka message
    const shouldSendRozetkaMessage =
      orderName &&
      /^№\d{9}$/.test(orderName) &&
      message.toLowerCase().includes('peredzvonit');

    if (shouldSendRozetkaMessage) {
      // Send Rozetka message asynchronously (don't block SMS response)
      sendRozetkaOrderMessage(orderName).catch((error) => {
        console.error('[SMS Route] Failed to send Rozetka message:', {
          orderName,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }

    await reply.send({ status: 'SMS sent successfully', smsResponse });
  } catch (error) {
    await reply.status(500).send({
      error: `An error occurred while sending SMS: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }
};

export default route;
