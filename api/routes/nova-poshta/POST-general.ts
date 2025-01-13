import type { RouteHandler } from 'gadget-server';
import { sendRequestNP } from '../../utilities/sendRequestNP';

const route: RouteHandler<{
  Body: {
    modelName: string;
    calledMethod: string;
    methodProperties: object;
  };
}> = async ({ request, reply }) => {
  try {
    const response = await sendRequestNP(request.body);
    await reply.send(response);
  } catch (error: any) {
    await reply.status(500).send({ error: error.message });
  }
};

export default route;
