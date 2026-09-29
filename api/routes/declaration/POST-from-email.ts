import { RouteHandler } from 'gadget-server';
import { google } from 'googleapis';
import { authorize } from 'api/utilities/suppliers/authorizeGoogle';
import {
  createFulfillment,
  getFulfillmentOrders,
} from 'api/utilities/shopify/fulfillWithDeclaration';

// Called by the Gmail Apps Script (scripts/gmail-ttn-to-shopify.gs) when a
// supplier replies with Nova Poshta TTNs. Runs only on demand, so no CPU cost
// while nothing arrives.
// Shopify hides customer phones from this app (protected customer data), so the
// phone is first resolved to an order number via the Rizka sheet, which the
// "send" extension fills with [date, order name, phone, ...] for every order sent.

interface Item {
  orderName?: string;
  phone?: string;
  ttn: string;
}

interface Body {
  secret: string;
  items: Item[];
}

type Status = 'fulfilled' | 'already' | 'not_found' | 'ambiguous' | 'invalid' | 'error';

interface ShopifyOrderNode {
  legacyResourceId: string;
  name: string;
  phone: string | null;
  displayFulfillmentStatus: string;
  shippingAddress: { phone: string | null } | null;
  customer: { phone: string | null } | null;
}

const SHOP_DOMAIN = 'c2da09-15.myshopify.com';
// Rizka supplier sheet written by extensions/send (spreadsheetId + default sheet 'Sheet2')
const RIZKA_SHEET_ID = '1Tb8YTGBhAONP0QXrsCohbsNF3TEN58zXQ785l20o7Ic';
const RIZKA_SHEET_RANGE = 'Sheet2!B:C';
const TTN_RE = /^(20|59)\d{12}$/;
const LOOKBACK_DAYS = 21;
const OPEN_STATUSES = ['OPEN', 'IN_PROGRESS'];

const RECENT_ORDERS_QUERY = `
  query RecentOrders($query: String!, $after: String) {
    orders(first: 250, after: $after, query: $query, sortKey: CREATED_AT, reverse: true) {
      nodes {
        legacyResourceId
        name
        phone
        displayFulfillmentStatus
        shippingAddress { phone }
        customer { phone }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const phoneKey = (value?: string | null) => (value || '').replace(/\D/g, '').slice(-9);

const orderPhoneKeys = (order: ShopifyOrderNode) =>
  [order.phone, order.shippingAddress?.phone, order.customer?.phone].map(phoneKey).filter((k) => k.length === 9);

const isFulfilled = (order: ShopifyOrderNode) => order.displayFulfillmentStatus === 'FULFILLED';

const fetchRecentOrders = async (shopifyClient: any): Promise<ShopifyOrderNode[]> => {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const all: ShopifyOrderNode[] = [];
  let after: string | null = null;
  do {
    const response: any = await shopifyClient.graphql(RECENT_ORDERS_QUERY, {
      query: `created_at:>=${since}`,
      after,
    });
    all.push(...response.orders.nodes);
    after = response.orders.pageInfo.hasNextPage ? response.orders.pageInfo.endCursor : null;
  } while (after);
  return all;
};

// phone key -> order names, from the Rizka sheet (column B = order name, C = phone)
const fetchSheetOrderNamesByPhone = async (config: any): Promise<Map<string, string[]>> => {
  const auth = await authorize(config);
  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: RIZKA_SHEET_ID,
    range: RIZKA_SHEET_RANGE,
  });
  const map = new Map<string, string[]>();
  for (const row of (response.data.values || []) as string[][]) {
    const name = (row[0] || '').trim();
    const key = phoneKey(row[1]);
    if (!name || key.length !== 9) continue;
    map.set(key, [...(map.get(key) || []), name]);
  }
  return map;
};

const route: RouteHandler<{ Body: Body }> = async ({ request, reply, connections, config, logger }) => {
  const { secret, items } = request.body;

  const expectedSecret = (config as unknown as Record<string, string | undefined>).DECLARATION_EMAIL_SECRET;
  if (!expectedSecret || secret !== expectedSecret) {
    await reply.code(401).send({ error: 'unauthorized' });
    return;
  }

  const shopifyClient = await connections.shopify.forShopDomain(SHOP_DOMAIN);
  let recentOrders: ShopifyOrderNode[] | null = null;
  let sheetNamesByPhone: Map<string, string[]> | null = null;
  const results: Array<{ ttn: string; orderName?: string; phone?: string; status: Status }> = [];

  for (const item of items) {
    const ttn = String(item.ttn || '').trim();
    const base = { ttn, orderName: item.orderName, phone: item.phone };

    if (!TTN_RE.test(ttn)) {
      results.push({ ...base, status: 'invalid' });
      continue;
    }

    try {
      if (!recentOrders) {
        recentOrders = await fetchRecentOrders(shopifyClient);
        logger.info(
          {
            orders_fetched: recentOrders.length,
            orders_with_phone: recentOrders.filter((o) => orderPhoneKeys(o).length > 0).length,
          },
          'Recent orders loaded for TTN matching'
        );
      }
      const orders = recentOrders;

      let matches: ShopifyOrderNode[] = [];
      if (item.orderName) {
        matches = orders.filter((o) => o.name === item.orderName!.trim());
      }
      const key = phoneKey(item.phone);
      if (matches.length === 0 && key.length === 9) {
        sheetNamesByPhone ??= await fetchSheetOrderNamesByPhone(config);
        const names = sheetNamesByPhone.get(key) || [];
        matches = orders.filter((o) => names.includes(o.name));
      }
      if (matches.length === 0 && key.length === 9) {
        matches = orders.filter((o) => orderPhoneKeys(o).includes(key));
      }

      if (matches.length === 0) {
        results.push({ ...base, status: 'not_found' });
        continue;
      }

      // The same customer may have older, already-shipped orders: target the unshipped one
      const open = matches.filter((o) => !isFulfilled(o));
      if (open.length === 0) {
        results.push({ ...base, orderName: matches[0].name, status: 'already' });
        continue;
      }
      if (open.length > 1) {
        results.push({ ...base, status: 'ambiguous' });
        continue;
      }

      const order = open[0];
      const fulfillmentOrders = await getFulfillmentOrders(shopifyClient, order.legacyResourceId);
      const openFulfillmentOrders = fulfillmentOrders.filter((edge) => OPEN_STATUSES.includes(edge.node.status));

      if (openFulfillmentOrders.length === 0) {
        results.push({ ...base, orderName: order.name, status: 'already' });
        continue;
      }

      let ok = true;
      for (const edge of openFulfillmentOrders) {
        const created = await createFulfillment(
          shopifyClient,
          edge.node.id,
          ttn,
          order.name,
          logger,
          'ТТН з email постачальника'
        );
        ok &&= created;
      }

      results.push({ ...base, orderName: order.name, status: ok ? 'fulfilled' : 'error' });
    } catch (error) {
      logger.error({ ttn, orderName: item.orderName, err: error }, 'Failed to apply TTN from email');
      results.push({ ...base, status: 'error' });
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
              phone: { type: 'string' },
              ttn: { type: 'string' },
            },
            required: ['ttn'],
          },
        },
      },
      required: ['secret', 'items'],
    },
  },
};

export default route;
