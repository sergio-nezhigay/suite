// S4 (2026-11-05): the «Передзвоніть» SMS also sends the buyer one Brevo email "we couldn't reach you".
// Pure logic with injected dependencies, so it is unit-tested without Gadget, Shopify or Brevo
// (scripts/test/unreachable-email.test.ts). Wired up in api/routes/POST-send-sms.ts.

export const CANCEL_TAG = 'Скасовано';
export const BREVO_TAG = 'unreachable';

// The «Передзвоніть» template's SMS is transliterated ("Peredzvonit' po zamovl. №…"). The Rozetka/Prom chat
// messages in POST-send-sms use the same check, so the button keeps one meaning.
export function isCallbackSms(message: string): boolean {
  return message.toLowerCase().includes('peredzvonit');
}

export type Mode = 'off' | 'test' | 'live';

export function modeOf(value: string | undefined): Mode {
  return value === 'live' || value === 'test' ? value : 'off';
}

export interface OrderNode {
  id: string;
  name: string;
  email: string | null;
  sourceName: string | null;
  cancelledAt: string | null;
  tags: string[];
  customer: { email: string | null } | null;
  billingAddress: { firstName: string | null; name: string | null } | null;
  shippingAddress: { firstName: string | null } | null;
  // Order metafield custom.marketplace_order: set on a site copy of a Rozetka/Prom order
  link: { value: string } | null;
  lineItems: { nodes: { name: string; currentQuantity: number }[] };
}

export function orderEmail(o: OrderNode): string {
  return (o.email ?? o.customer?.email ?? '').trim();
}

// Same filters as review-request's isReviewable (automations-wrangler): site order, not cancelled in Shopify
// or by tag, not a marketplace copy, a real email. Rozetka/Prom buyers get their marketplace chat message
// from this route instead. A copy made by staff in the admin is not sourceName "web", so it is skipped too.
export function isEligible(o: OrderNode): boolean {
  const email = orderEmail(o);
  if (o.sourceName !== 'web' || o.cancelledAt || o.link?.value.trim()) return false;
  if (/^[RP]-/.test(o.name) || !email.includes('@') || /example/i.test(email)) return false;
  return !o.tags.includes(CANCEL_TAG);
}

// First name only, as in review-request
export function firstName(o: OrderNode): string {
  return (
    o.billingAddress?.firstName?.trim() ||
    o.shippingAddress?.firstName?.trim() ||
    (o.billingAddress?.name ?? '').trim().split(/\s+/)[0] ||
    ''
  );
}

export interface UnreachableParams {
  order_number: string;
  first_name: string;
  items: { title: string }[];
}

export function emailParams(o: OrderNode): UnreachableParams {
  const name = o.name.trim();
  return {
    order_number: name.startsWith('№') ? name : `№${name.replace(/^#/, '')}`,
    first_name: firstName(o),
    items: o.lineItems.nodes.filter((li) => li.currentQuantity > 0).slice(0, 5).map((li) => ({ title: li.name })),
  };
}

export interface SentRecord {
  id: string;
  status: string;
}

export interface Deps {
  mode: Mode;
  testTo: string;
  templateId: number;
  findOrder: (orderName: string) => Promise<OrderNode | null>;
  // One record per order key. create returns null when another press already created it (unique key).
  store: {
    find: (key: string) => Promise<SentRecord | null>;
    create: (key: string, orderName: string) => Promise<SentRecord | null>;
    update: (id: string, data: { status: string; messageId?: string; error?: string }) => Promise<void>;
  };
  send: (email: { templateId: number; to: { email: string; name?: string }[]; params: object; tags: string[] }) => Promise<string>;
  log: { info: (data: object, msg: string) => void; error: (data: object, msg: string) => void };
}

export type Outcome = 'off' | 'not-found' | 'skipped' | 'already' | 'sent' | 'failed';

// Sends at most one email per order. A failed send keeps its record as "failed" and is retried on the next
// press only. Test mode sends to testTo only and keeps its own "test:" records, so live sends start clean.
export async function sendUnreachableEmail(orderName: string, deps: Deps): Promise<Outcome> {
  if (deps.mode === 'off') return 'off';
  const order = await deps.findOrder(orderName);
  if (!order) {
    deps.log.info({ orderName }, '[unreachable] order not found');
    return 'not-found';
  }
  if (!isEligible(order)) {
    deps.log.info({ orderName }, '[unreachable] skipped by the order filters');
    return 'skipped';
  }

  const key = (deps.mode === 'test' ? 'test:' : '') + order.id;
  let record = await deps.store.find(key);
  if (record && record.status !== 'failed') return 'already';
  if (!record) {
    record = await deps.store.create(key, order.name);
    if (!record) return 'already';
  }

  const to = deps.mode === 'test' ? deps.testTo : orderEmail(order);
  try {
    const messageId = await deps.send({
      templateId: deps.templateId,
      to: [{ email: to }],
      params: emailParams(order),
      tags: [deps.mode === 'test' ? `${BREVO_TAG}-test` : BREVO_TAG],
    });
    await deps.store.update(record.id, { status: 'sent', messageId });
    deps.log.info({ orderName, mode: deps.mode, messageId }, '[unreachable] email sent');
    return 'sent';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await deps.store.update(record.id, { status: 'failed', error: message.slice(0, 500) }).catch(() => {});
    deps.log.error({ orderName, error: message }, '[unreachable] email failed');
    return 'failed';
  }
}

export const ORDER_QUERY = `
  query UnreachableOrder($query: String!) {
    orders(first: 5, query: $query) {
      nodes {
        id
        name
        email
        sourceName
        cancelledAt
        tags
        customer { email }
        billingAddress { firstName name }
        shippingAddress { firstName }
        link: metafield(namespace: "custom", key: "marketplace_order") { value }
        lineItems(first: 10) { nodes { name currentQuantity } }
      }
    }
  }
`;

// Brevo transactional send with a timeout; the template holds subject, sender and reply-to
export async function brevoSend(apiKey: string, email: object, timeoutMs = 8000): Promise<string> {
  if (!apiKey) throw new Error('BREVO_API_KEY is not set');
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(email),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Brevo HTTP ${res.status}: ${body.slice(0, 300)}`);
  return (JSON.parse(body || '{}') as { messageId?: string }).messageId ?? '';
}
