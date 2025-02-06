import type { RouteHandler } from 'fastify';
import { smsClient } from 'utilities';

const route: RouteHandler = async (request, reply) => {
  const { to, message } = request.body as { to: string; message: string };
  console.log('🚀 ~ RouteHandler...:', to, message);

  if (!to || !message) {
    return await reply
      .status(400)
      .send({ error: '`to` and `message` parameters are required' });
  }

  try {
    const smsResponse = await smsClient(to, message);
    console.log('🚀 ~ smsResponse:', smsResponse);
    await reply.send({ status: 'SMS sent successfully', smsResponse });
  } catch (error) {
    console.log('🚀 ~ error:', error);
    await reply.status(500).send({
      error: `An error occurred while sending SMS: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }
};

export default route;
