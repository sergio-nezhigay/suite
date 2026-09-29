import { RouteHandler } from 'gadget-server';
import {
  createFulfillment,
  getFulfillmentOrders,
} from 'api/utilities/shopify/fulfillWithDeclaration';

// Called by the Gmail Apps Script (scripts/gmail-ttn-to-shopify.gs) when a
// supplier replies with Nova Poshta TTNs. Runs only on demand, so no CPU cost
// while nothing arrives. Orders are matched by name (the "Order" column of the
// supplier email); customer phones are hidden from this app by Shopify.

interface Item {
  orderName: string;
  ttn: string;
}

interface Body {
  secret: string;
  items: Item[];
}

type Status = 'fulfilled' | 'already' | 'not_found' | 'invalid' | 'error';

const SHOP_DOMAIN = 'c2da09-15.myshopify.com';
const TTN_RE = /^(20|59)\d{12}$/;
const OPEN_STATUSES = ['OPEN', 'IN_PROGRESS'];

const ORDER_BY_NAME_QUERY = `
  query OrderByName($query: String!) {
    orders(first: 5, query: $query) {
      nodes {
        legacyResourceId
        name
      }
    }
  }
`;

const findOrderByName = async (shopifyClient: any, orderName: string) => {
  const response: any = await shopifyClient.graphql(ORDER_BY_NAME_QUERY, {
    query: `name:"${orderName}"`,
  });
  // Search is fuzzy; keep only the exact name
  return (response.orders.nodes as Array<{ legacyResourceId: string; name: string }>).find(
    (o) => o.name === orderName
  );
};

const route: RouteHandler<{ Body: Body }> = async ({ request, reply, connections, config, logger }) => {
  const { secret, items } = request.body;

  const expectedSecret = (config as unknown as Record<string, string | undefined>).DECLARATION_EMAIL_SECRET;
  if (!expectedSecret || secret !== expectedSecret) {
    await reply.code(401).send({ error: 'unauthorized' });
    return;
  }

  const shopifyClient = await connections.shopify.forShopDomain(SHOP_DOMAIN);
  const results: Array<{ ttn: string; orderName: string; status: Status }> = [];

  for (const item of items) {
    const ttn = String(item.ttn || '').trim();
    const orderName = String(item.orderName || '').trim();

    if (!TTN_RE.test(ttn) || !orderName) {
      results.push({ ttn, orderName, status: 'invalid' });
      continue;
    }

    try {
      const order = await findOrderByName(shopifyClient, orderName);
      if (!order) {
        results.push({ ttn, orderName, status: 'not_found' });
        continue;
      }

      const fulfillmentOrders = await getFulfillmentOrders(shopifyClient, order.legacyResourceId);
      const openFulfillmentOrders = fulfillmentOrders.filter((edge) => OPEN_STATUSES.includes(edge.node.status));

      if (openFulfillmentOrders.length === 0) {
        results.push({ ttn, orderName, status: 'already' });
        continue;
      }

      let ok = true;
      for (const edge of openFulfillmentOrders) {
        const created = await createFulfillment(
          shopifyClient,
          edge.node.id,
          ttn,
          orderName,
          logger,
          'ТТН з email постачальника'
        );
        ok &&= created;
      }

      results.push({ ttn, orderName, status: ok ? 'fulfilled' : 'error' });
    } catch (error) {
      logger.error({ ttn, orderName, err: error }, 'Failed to apply TTN from email');
      results.push({ ttn, orderName, status: 'error' });
    }
  }

  logger.info({ stage: 'declaration_from_email', results }, 'Declaration from email processed');
  await reply.send({ results });
};

route.options = {
  schema: {
    body: {
      type: 'object',
      properties: {
        secret: { type: 'string' },
        items: {
          type: 'array',
          maxItems: 50,
          items: {
            type: 'object',
            properties: {
              orderName: { type: 'string' },
              ttn: { type: 'string' },
            },
            required: ['orderName', 'ttn'],
          },
        },
      },
      required: ['secret', 'items'],
    },
  },
};

export default route;
