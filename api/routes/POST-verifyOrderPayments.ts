import { RouteContext } from 'gadget-server';

// Called by the "Check Payments" order-list extension; all logic lives in the action
export default async function route({ request, reply, api, logger }: RouteContext) {
  const { orderData } = (request.body || {}) as { orderData?: any[] };

  if (!orderData?.length) {
    return reply.code(400).send({ success: false, error: 'orderData is required' });
  }

  try {
    const result = await (api.verifyOrderPayments as any)({ orderData });
    return reply.send(result);
  } catch (error) {
    logger.error({ err: error }, 'Error in verifyOrderPayments route');
    return reply.code(500).send({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
