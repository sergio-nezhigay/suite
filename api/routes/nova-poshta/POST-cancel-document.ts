import type { RouteHandler } from 'gadget-server';
import { npClient } from 'utilities';

const route: RouteHandler<{
  Body: {
    DocumentRefs: string;
  };
}> = async ({ request, reply }) => {
  const { DocumentRefs } = request.body;

  if (!DocumentRefs) {
    return await reply
      .status(400)
      .send({ error: 'Declaration refs are required' });
  }

  const payload = {
    modelName: 'InternetDocument',
    calledMethod: 'delete',
    methodProperties: {
      DocumentRefs: [DocumentRefs],
    },
  };

  try {
    const response = await npClient(payload);
    console.log('🚀 ~ Cancel document response:', JSON.stringify(response));

    if (response.success) {
      await reply.send({
        message: 'Declaration successfully canceled',
        data: response,
      });
    } else {
      throw new Error(
        response.errors?.[0] || 'Failed to cancel the declaration'
      );
    }
  } catch (error: any) {
    await reply.status(500).send({ error: error.message });
  }
};

export default route;
