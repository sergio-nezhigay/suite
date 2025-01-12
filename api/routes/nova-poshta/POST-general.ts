import type { RouteHandler } from 'gadget-server';
import { sendRequestNP } from '../../utilities/sendRequestNP';

const route: RouteHandler<{
  Body: {
    apiKey: string;
    modelName: string;
    calledMethod: string;
    methodProperties: object;
  };
}> = async ({ request, reply }) => {
  const { modelName, calledMethod, methodProperties } = request.body;
  console.log('🚀 ~POST-general payload:', {
    modelName,
    calledMethod,
    methodProperties,
  });

  if (!modelName || !calledMethod || !methodProperties) {
    return await reply.status(400).send({ error: 'All fields are required' });
  }

  try {
    const response = await sendRequestNP({
      modelName,
      calledMethod,
      methodProperties,
    });
    await reply.send(response);
  } catch (error: any) {
    await reply.status(500).send({ error: error.message });
  }
};

export default route;
