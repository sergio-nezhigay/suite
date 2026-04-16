import { RouteHandler } from 'gadget-server';

const route: RouteHandler<{ Body: { orderIds: string[]; autoCreateChecks?: boolean; orderData?: any[] } }> = async ({
  request,
  reply,
  api,
  logger,
}) => {
  try {
    const { orderIds, autoCreateChecks = true, orderData } = request.body;

    if (!orderIds || !Array.isArray(orderIds)) {
      await reply.code(400).send({
        success: false,
        error: 'orderIds parameter is required and must be an array',
      });
      return;
    }
    const result = await (api.verifyOrderPayments as any)({
      orderIds: orderIds,
      autoCreateChecks: autoCreateChecks,
      orderData: orderData,
    });

    await reply.send(result);
  } catch (error) {
    logger.error({ err: error }, 'Error in verifyOrderPayments route');
    await reply.code(500).send({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

route.options = {
  schema: {
    body: {
      type: 'object',
      properties: {
        orderIds: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['orderIds'],
    },
  },
  cors: {
    origin: true,
  },
};

export default route;
