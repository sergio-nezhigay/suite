import { RouteHandler } from 'gadget-server';

// No longer called: since the box moved to the Cloudflare worker (automations-wrangler,
// src/routes/easybuy-cod-check) to stop waking Gadget. Kept for rollback; delete once the worker is proven.
// Was called by the thank-you / order-status box (extensions/thank-you-easybuy).
// Answers one question: is this a COD order where every item is EasyBuy (SKU ends in ^ИИ)?
// The shop comes from the Shopify session token (Gadget verifies it), never from the request body.

const COD_GATEWAY = 'накладений';
const EASYBUY_SKU_SUFFIX = '^ИИ';

const ORDER_QUERY = `
  query EasyBuyCodCheck($id: ID!) {
    order(id: $id) {
      transactions(first: 10) { gateway formattedGateway }
      lineItems(first: 50) { nodes { sku } }
    }
  }
`;

interface Body {
  orderId?: string;
}

const route: RouteHandler<{ Body: Body }> = async ({ request, reply, connections, logger }) => {
  const shopify = connections.shopify.current;
  if (!shopify || !connections.shopify.currentSession) {
    return reply.code(401).send({ show: false });
  }

  // Thank-you page sends gid://shopify/OrderIdentity/<n>, order page sends gid://shopify/Order/<n>
  const numericId = String(request.body?.orderId ?? '').match(/(\d+)$/)?.[1];
  if (!numericId) {
    return reply.code(400).send({ show: false });
  }

  try {
    const data = (await shopify.graphql(ORDER_QUERY, {
      id: `gid://shopify/Order/${numericId}`,
    })) as {
      order: {
        transactions: { gateway: string | null; formattedGateway: string | null }[];
        lineItems: { nodes: { sku: string | null }[] };
      } | null;
    };

    const order = data?.order;
    if (!order) {
      return reply.send({ show: false });
    }

    const isCod = order.transactions.some((t) =>
      `${t.gateway ?? ''} ${t.formattedGateway ?? ''}`.toLowerCase().includes(COD_GATEWAY)
    );
    const items = order.lineItems.nodes;
    const easyBuyOnly =
      items.length > 0 && items.every((item) => (item.sku ?? '').endsWith(EASYBUY_SKU_SUFFIX));

    return reply.send({ show: isCod && easyBuyOnly });
  } catch (error) {
    logger.error({ err: error, numericId }, 'easybuy-cod-check failed');
    return reply.code(500).send({ show: false });
  }
};

export default route;
