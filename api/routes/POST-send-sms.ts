import { RouteHandler } from 'fastify';
import { sendSms } from '../utilities/sendSms';

const route: RouteHandler<{ Body: { to: string; message: string } }> = async ({
  request,
  reply,
}) => {
  const { to, message } = request.body;

  if (!to || !message) {
    return await reply
      .status(400)
      .send({ error: '`to` and `message` parameters are required' });
  }

  try {
    const smsResponse = await sendSms(to, message);
    await reply.send({ status: 'SMS sent successfully', smsResponse });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('INVROUTE')) {
        await reply.status(400).send({
          error: 'Invalid routing configuration or recipient format.',
          details: error.message,
        });
      } else if (error.message.includes('Network error')) {
        await reply.status(500).send({
          error:
            'Network error occurred while trying to send SMS. Please try again later.',
          details: error.message,
        });
      }
    } else {
      await reply.status(500).send({
        error: 'An unknown error occurred.',
        details: JSON.stringify(error),
      });
    }
  }
};
