import type { RouteHandler } from 'fastify';
import { logger } from 'gadget-server';
import { smsClient } from 'utilities';
import { rozetkaOrderIdFromName, sendRozetkaOrderMessage } from '../utilities/rozetka/sendRozetkaMessage';
import { promOrderIdFromName, sendPromOrderMessage } from '../utilities/prom/sendPromMessage';

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
    const isCallbackMessage = message.toLowerCase().includes('peredzvonit');
    // Check if we should send a Rozetka message
    const shouldSendRozetkaMessage =
      orderName &&
      rozetkaOrderIdFromName(orderName) !== null &&
      isCallbackMessage;
    const shouldSendPromMessage =
      orderName &&
      promOrderIdFromName(orderName) !== null &&
      isCallbackMessage;

    if (shouldSendPromMessage) {
      // Send Prom message asynchronously (don't block SMS response)
      sendPromOrderMessage(orderName).catch((error) => {
        logger.error({
          orderName,
          error: error instanceof Error ? error.message : String(error),
        }, '[SMS Route] Failed to send Prom message');
      });
    }

    if (shouldSendRozetkaMessage) {
      // Send Rozetka message asynchronously (don't block SMS response)
      sendRozetkaOrderMessage(orderName).catch((error) => {
        logger.error({
          orderName,
          error: error instanceof Error ? error.message : String(error),
        }, '[SMS Route] Failed to send Rozetka message');
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
