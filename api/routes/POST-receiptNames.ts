import { RouteContext } from 'gadget-server';
import { assignReceiptNames } from '../utilities/fiscal/receiptNames';

type ReceiptNamesBody = {
  orders?: {
    id: string;
    lineItems: { id: string; title: string; price: string }[];
  }[];
};

// Preview of check names; the same function runs again when the check is issued
export default async function route({ request, reply }: RouteContext) {
  const { orders } = (request.body || {}) as ReceiptNamesBody;

  if (!orders?.length) {
    return reply.code(400).send({ error: 'Orders data required' });
  }

  const names: Record<string, string> = {};
  for (const order of orders) {
    const assigned = assignReceiptNames(order.lineItems, order.id);
    order.lineItems.forEach((item, index) => {
      names[item.id] = assigned[index];
    });
  }

  return reply.send({ names });
}
