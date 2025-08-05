import { RouteHandler } from 'gadget-server';

interface RouteParams {
  orderNumber: string;
}

const route: RouteHandler<{ Params: RouteParams }> = async ({
  request,
  reply,
}) => {
  const orderNumber = request.params.orderNumber;

  console.log('Order number:', orderNumber);
  const declarationNumber = await order2declarationNumber(orderNumber);

  await reply.send({ status: 'success', declarationNumber });
};

export default route;

async function order2declarationNumber(orderNumber: string): Promise<string> {
  return `DECL-${orderNumber}`;
}
