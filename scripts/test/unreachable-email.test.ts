// Tests for api/utilities/unreachableEmail.ts (S4) with fake Shopify, store and Brevo. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emailParams,
  isCallbackSms,
  isEligible,
  modeOf,
  sendUnreachableEmail,
  type Deps,
  type OrderNode,
} from '../../api/utilities/unreachableEmail.ts';

const order = (over: Partial<OrderNode> = {}): OrderNode => ({
  id: 'gid://shopify/Order/1',
  name: '№17423',
  email: 'olena@ukr.net',
  sourceName: 'web',
  cancelledAt: null,
  tags: ['Не додзв-2'],
  customer: null,
  billingAddress: { firstName: 'Олена', name: 'Олена Петренко' },
  shippingAddress: { firstName: 'Олена' },
  link: null,
  lineItems: { nodes: [{ name: 'SODIMM 16Gb DDR4', currentQuantity: 1 }, { name: 'Removed item', currentQuantity: 0 }] },
  ...over,
});

function fakeDeps(o: OrderNode | null, over: Partial<Deps> = {}) {
  const rows = new Map<string, { id: string; status: string }>();
  const sends: any[] = [];
  let sendFails = false;
  const deps: Deps = {
    mode: 'live',
    testTo: 'owner@test.ua',
    templateId: 14,
    findOrder: async () => o,
    store: {
      find: async (key) => rows.get(key) ?? null,
      create: async (key) => {
        if (rows.has(key)) return null;
        const r = { id: String(rows.size + 1), status: 'sending' };
        rows.set(key, r);
        return { ...r };
      },
      update: async (id, data) => {
        for (const r of rows.values()) if (r.id === id) r.status = data.status;
      },
    },
    send: async (email) => {
      if (sendFails) throw new Error('Brevo HTTP 500');
      sends.push(email);
      return 'msg-' + sends.length;
    },
    log: { info() {}, error() {} },
    ...over,
  };
  return { deps, rows, sends, failNext: (v: boolean) => (sendFails = v) };
}

test('callback SMS is spotted by its transliterated text', () => {
  assert.equal(isCallbackSms("Peredzvonit' po zamovl. №17423. (099)381-5288, informatica.com.ua"), true);
  assert.equal(isCallbackSms('Rekvizyty dlia oplaty...'), false);
});

test('mode defaults to off', () => {
  assert.equal(modeOf(undefined), 'off');
  assert.equal(modeOf('LIVE'), 'off');
  assert.equal(modeOf('test'), 'test');
  assert.equal(modeOf('live'), 'live');
});

test('filters: site order with a real email passes', () => {
  assert.equal(isEligible(order()), true);
  assert.equal(isEligible(order({ email: null, customer: { email: 'c@gmail.com' } })), true);
});

test('filters: each skip rule', () => {
  const skip: [string, Partial<OrderNode>][] = [
    ['not web', { sourceName: 'shopify_draft_order' }],
    ['marketplace source id', { sourceName: '214894870529' }],
    ['cancelled in Shopify', { cancelledAt: '2026-11-05T10:00:00Z' }],
    ['«Скасовано» tag', { tags: ['Скасовано'] }],
    ['marketplace copy link', { link: { value: 'R-910798863' } }],
    ['Rozetka name', { name: 'R-910798863' }],
    ['Prom name', { name: 'P-123456' }],
    ['no email', { email: null }],
    ['not an email', { email: 'none' }],
    ['example email', { email: 'buyer@Example.com' }],
  ];
  for (const [why, over] of skip) assert.equal(isEligible(order(over)), false, why);
  assert.equal(isEligible(order({ link: { value: '  ' } })), true, 'blank link is no link');
});

test('params: first name only, items still in the order, № kept', () => {
  assert.deepEqual(emailParams(order()), {
    order_number: '№17423',
    first_name: 'Олена',
    items: [{ title: 'SODIMM 16Gb DDR4' }],
  });
  const p = emailParams(order({ name: '#17423', billingAddress: { firstName: null, name: 'Ігор Коваль' }, shippingAddress: null }));
  assert.equal(p.order_number, '№17423');
  assert.equal(p.first_name, 'Ігор');
});

test('live: sends once to the buyer with tag unreachable', async () => {
  const f = fakeDeps(order());
  assert.equal(await sendUnreachableEmail('№17423', f.deps), 'sent');
  assert.equal(f.sends.length, 1);
  assert.deepEqual(f.sends[0].to, [{ email: 'olena@ukr.net' }]);
  assert.deepEqual(f.sends[0].tags, ['unreachable']);
  assert.equal(f.sends[0].templateId, 14);
});

test('second press sends nothing', async () => {
  const f = fakeDeps(order());
  await sendUnreachableEmail('№17423', f.deps);
  assert.equal(await sendUnreachableEmail('№17423', f.deps), 'already');
  assert.equal(f.sends.length, 1);
});

test('two presses at the same moment send one email', async () => {
  const f = fakeDeps(order());
  const out = await Promise.all([sendUnreachableEmail('№17423', f.deps), sendUnreachableEmail('№17423', f.deps)]);
  assert.deepEqual(out.sort(), ['already', 'sent']);
  assert.equal(f.sends.length, 1);
});

test('Brevo failure: reported, record failed, next press retries once', async () => {
  const f = fakeDeps(order());
  f.failNext(true);
  assert.equal(await sendUnreachableEmail('№17423', f.deps), 'failed');
  assert.equal([...f.rows.values()][0].status, 'failed');
  f.failNext(false);
  assert.equal(await sendUnreachableEmail('№17423', f.deps), 'sent');
  assert.equal(await sendUnreachableEmail('№17423', f.deps), 'already');
  assert.equal(f.sends.length, 1);
});

test('test mode: only the test address, own records', async () => {
  const f = fakeDeps(order(), { mode: 'test' });
  assert.equal(await sendUnreachableEmail('№17423', f.deps), 'sent');
  assert.deepEqual(f.sends[0].to, [{ email: 'owner@test.ua' }]);
  assert.deepEqual(f.sends[0].tags, ['unreachable-test']);
  assert.ok(f.rows.has('test:gid://shopify/Order/1'));
  assert.ok(!f.rows.has('gid://shopify/Order/1'), 'live record untouched');
});

test('off mode: no lookup, no send', async () => {
  let looked = false;
  const f = fakeDeps(order(), { mode: 'off', findOrder: async () => ((looked = true), order()) });
  assert.equal(await sendUnreachableEmail('№17423', f.deps), 'off');
  assert.equal(looked, false);
  assert.equal(f.sends.length, 0);
});

test('skipped and unknown orders send nothing and keep no record', async () => {
  const f = fakeDeps(order({ tags: ['Скасовано'] }));
  assert.equal(await sendUnreachableEmail('№17423', f.deps), 'skipped');
  const g = fakeDeps(null);
  assert.equal(await sendUnreachableEmail('№1', g.deps), 'not-found');
  assert.equal(f.rows.size + g.rows.size + f.sends.length + g.sends.length, 0);
});
