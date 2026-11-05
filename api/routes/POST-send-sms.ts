import type { RouteHandler } from 'fastify';
import { api, connections, logger } from 'gadget-server';
import { smsClient } from 'utilities';
import { rozetkaOrderIdFromName, sendRozetkaOrderMessage } from '../utilities/rozetka/sendRozetkaMessage';
import { promOrderIdFromName, sendPromOrderMessage } from '../utilities/prom/sendPromMessage';
import {
  ORDER_QUERY,
  brevoSend,
  isCallbackSms,
  modeOf,
  sendUnreachableEmail,
  type OrderNode,
} from '../utilities/unreachableEmail';

const SHOP_DOMAIN = 'c2da09-15.myshopify.com';

// S4: one "couldn't reach you" email per site order with the «Передзвоніть» SMS. Mode via
// UNREACHABLE_EMAIL_MODE (off | test | live, default off); test sends only to UNREACHABLE_EMAIL_TEST_TO.
// Never throws, so the SMS answer stays a success whatever happens here.
async function unreachableEmail(orderName: string) {
  try {
    const env = process.env;
    const outcome = await sendUnreachableEmail(orderName, {
      mode: modeOf(env.UNREACHABLE_EMAIL_MODE),
      testTo: env.UNREACHABLE_EMAIL_TEST_TO || 'nezhihai@gmail.com',
      templateId: Number(env.UNREACHABLE_TEMPLATE_ID),
      findOrder: async (name) => {
        const shopify = await connections.shopify.forShopDomain(SHOP_DOMAIN);
        const data: any = await shopify.graphql(ORDER_QUERY, { query: `name:"${name.replace(/"/g, '')}"` });
        // Search is fuzzy; keep only the exact name
        return ((data?.orders?.nodes ?? []) as OrderNode[]).find((o) => o.name === name) ?? null;
      },
      store: {
        find: async (orderKey) => {
          const r = await api.unreachableEmail.maybeFindFirst({
            filter: { orderKey: { equals: orderKey } },
            select: { id: true, status: true },
          });
          return r ? { id: r.id, status: r.status ?? '' } : null;
        },
        create: async (orderKey, name) => {
          try {
            const r = await api.unreachableEmail.create({ orderKey, orderName: name, status: 'sending' });
            return { id: r.id, status: 'sending' };
          } catch (error) {
            // Unique orderKey: another press got here first
            logger.info({ orderKey, error: error instanceof Error ? error.message : String(error) }, '[unreachable] record exists');
            return null;
          }
        },
        update: async (id, data) => {
          await api.unreachableEmail.update(id, data);
        },
      },
      send: (email) => brevoSend(env.BREVO_API_KEY ?? '', email),
      log: logger,
    });
    logger.info({ orderName, outcome }, '[unreachable] done');
  } catch (error) {
    logger.error({ orderName, error: error instanceof Error ? error.message : String(error) }, '[unreachable] unexpected error');
  }
}

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
    const isCallbackMessage = isCallbackSms(message);
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

    // Awaited before the reply: work left running after it may be cut off. Bounded by Brevo's 8 s timeout.
    // Rozetka/Prom buyers get the marketplace chat message above instead
    if (orderName && isCallbackMessage && !/^[RP]-/.test(orderName)) await unreachableEmail(orderName);

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
