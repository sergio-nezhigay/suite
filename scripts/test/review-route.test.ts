// Tests for api/routes/GET-review.ts with a mocked fetch (never calls Judge.me).
// Run: npm test
import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import route from '../../api/routes/GET-review.ts';

const PRODUCT = '9708733923644';
const HANDLE = 'm471a1k43eb1-cwe';
const good = {
  email: 'a+b@x.ua',
  name: 'Олена П',
  product_id: PRODUCT,
  product_handle: HANDLE,
  review_rating: '5',
  review_body: 'Підійшло',
};
const THANKS = `https://informatica.com.ua/products/${HANDLE}?utm_source=brevo&utm_medium=email&utm_campaign=review_request#judgeme_product_reviews&thanks=1`;
const PAGE = `https://informatica.com.ua/products/${HANDLE}?utm_source=brevo&utm_medium=email&utm_campaign=review_request#judgeme_product_reviews`;
const NAME = '&name=%D0%9E%D0%BB%D0%B5%D0%BD%D0%B0%20%D0%9F';
const EMAIL = '&email=a%2Bb%40x.ua';
const FORM = `${PAGE}&rating=5${NAME}${EMAIL}`;
const FORM_NO_RATING = `${PAGE}${NAME}${EMAIL}`;
const HOME = 'https://informatica.com.ua/';

type Call = { url: string; method: string; body?: any };
let calls: Call[];
let lookup: () => Response;
let create: () => Response;
let knownProducts: Set<string>;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

// The route remembers recent saves for 2 min; each test starts 10 min later.
let clock = Date.now();
beforeEach(() => {
  mock.timers.enable({ apis: ['Date'], now: (clock += 10 * 60 * 1000) });
  calls = [];
  knownProducts = new Set([PRODUCT]);
  lookup = () => json({ reviews: [] });
  create = () => json({ message: 'ok' });
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ url: String(url), method, body: init.body && JSON.parse(String(init.body)) });
    return method === 'POST' ? create() : lookup();
  }) as typeof fetch;
});

afterEach(() => mock.timers.reset());

async function run(query: Record<string, unknown>) {
  const sent = { code: 0, location: '' };
  const reply: any = {
    code: (c: number) => ((sent.code = c), reply),
    header: (k: string, v: string) => (k === 'Location' && (sent.location = v), reply),
    send: () => reply,
  };
  const logger = { warn() {}, error() {}, info() {} };
  const api = {
    shopifyProduct: { maybeFindOne: async (id: string) => (knownProducts.has(id) ? { id } : null) },
  };
  await (route as any)({ request: { query }, reply, logger, api });
  return sent;
}

const posts = () => calls.filter((c) => c.method === 'POST');

// Only the utm keys may sit before the hash; personal data rides in the hash.
function assertNoPersonalDataInQuery(location: string) {
  const keys = [...new URL(location).searchParams.keys()];
  assert.ok(keys.every((key) => key.startsWith('utm_')), `unexpected query keys: ${keys}`);
  assert.ok(!location.split('#')[0].includes('%40'), 'email in the query');
}

test('good request: 1 POST with the product id, then thanks', async () => {
  const sent = await run(good);
  assert.equal(posts().length, 1);
  const body = posts()[0].body;
  assert.equal(body.id, PRODUCT);
  assert.equal(body.review_type, 'product');
  assert.equal(body.verified_buyer, true);
  assert.equal(body.rating, 5);
  assert.equal(calls[0].method, 'GET');
  assert.ok(calls[0].url.includes('reviewer_email=a%2Bb%40x.ua'));
  assert.deepEqual(sent, { code: 302, location: THANKS });
});

test('repeat: same email + product already reviewed, 0 POSTs, then thanks', async () => {
  lookup = () => json({ reviews: [{ product_external_id: Number(PRODUCT), reviewer: { email: 'A+B@x.ua' } }] });
  const sent = await run(good);
  assert.equal(posts().length, 0);
  assert.deepEqual(sent, { code: 302, location: THANKS });
});

test('lookup returns other reviews only (ignored filter): still 1 POST', async () => {
  lookup = () =>
    json({
      reviews: [
        { product_external_id: Number(PRODUCT), reviewer: { email: 'someone@else.ua' } },
        { product_external_id: 0, reviewer: { email: 'a+b@x.ua' } },
      ],
    });
  const sent = await run(good);
  assert.equal(posts().length, 1);
  assert.equal(sent.location, THANKS);
});

for (const review_rating of ['0', '6', '4.5', 'abc', '', undefined, ['5', '5']]) {
  test(`bad rating ${JSON.stringify(review_rating)}: 0 fetches, form`, async () => {
    const sent = await run({ ...good, review_rating });
    assert.equal(calls.length, 0);
    assert.deepEqual(sent, { code: 302, location: FORM_NO_RATING });
  });
}

for (const product_id of ['', 'abc', '12.5', '-1', undefined]) {
  test(`bad product id ${JSON.stringify(product_id)}: 0 fetches, form`, async () => {
    const sent = await run({ ...good, product_id });
    assert.equal(calls.length, 0);
    assert.deepEqual(sent, { code: 302, location: FORM });
  });
}

test('unknown product id (would be a shop review): 0 fetches, form', async () => {
  const sent = await run({ ...good, product_id: '123' });
  assert.equal(calls.length, 0);
  assert.deepEqual(sent, { code: 302, location: FORM });
});

test('no email: 0 fetches, form without the email', async () => {
  const sent = await run({ ...good, email: '' });
  assert.equal(calls.length, 0);
  assert.equal(sent.location, FORM.replace(EMAIL, ''));
});

test('no name (Judge.me requires one): 0 fetches, form without the name', async () => {
  const sent = await run({ ...good, name: ' ' });
  assert.equal(calls.length, 0);
  assert.equal(sent.location, FORM.replace(NAME, ''));
});

test('handle with an underscore is accepted', async () => {
  const sent = await run({ ...good, product_handle: 'ddr4_8gb' });
  assert.equal(posts().length, 1);
  assert.equal(sent.location, THANKS.replace(HANDLE, 'ddr4_8gb'));
});

test('product lookup error: 0 fetches, form', async () => {
  knownProducts = { has: () => { throw new Error('db down'); } } as any;
  const sent = await run(good);
  assert.equal(calls.length, 0);
  assert.deepEqual(sent, { code: 302, location: FORM });
});

test('double tap: two requests at once, 1 POST, both thanks', async () => {
  const [a, b] = await Promise.all([run(good), run(good)]);
  assert.equal(posts().length, 1);
  assert.equal(a.location, THANKS);
  assert.equal(b.location, THANKS);
});

test('a failed save can be retried at once', async () => {
  create = () => json({ error: 'x' }, 500);
  assert.equal((await run(good)).location, FORM);
  create = () => json({ message: 'ok' });
  assert.equal((await run(good)).location, THANKS);
  assert.equal(posts().length, 2);
});

for (const product_handle of ['', undefined, '../x', '//evil.com', 'a/b', 'x?y=1', 'x#y']) {
  test(`bad handle ${JSON.stringify(product_handle)}: 0 fetches, plain home page`, async () => {
    const sent = await run({ ...good, product_handle });
    assert.equal(calls.length, 0);
    assert.deepEqual(sent, { code: 302, location: HOME });
  });
}

test('Judge.me lookup error: 0 POSTs, form', async () => {
  lookup = () => json({ error: 'x' }, 500);
  const sent = await run(good);
  assert.equal(posts().length, 0);
  assert.deepEqual(sent, { code: 302, location: FORM });
});

test('Judge.me create error: form', async () => {
  create = () => json({ error: 'x' }, 422);
  const sent = await run(good);
  assert.equal(posts().length, 1);
  assert.deepEqual(sent, { code: 302, location: FORM });
});

test('fetch throws: form', async () => {
  lookup = () => {
    throw new Error('network down');
  };
  const sent = await run(good);
  assert.deepEqual(sent, { code: 302, location: FORM });
});

test('no personal data in any redirect query; the email keeps its +', async () => {
  for (const query of [good, { ...good, review_rating: '9' }, { ...good, product_handle: '' }]) {
    const sent = await run(query);
    assertNoPersonalDataInQuery(sent.location);
    assert.ok(!sent.location.includes('Підійшло') && !sent.location.includes(encodeURIComponent('Підійшло')));
  }
  const sent = await run({ ...good, review_rating: '9' });
  assert.equal(new URLSearchParams(new URL(sent.location).hash.slice(1)).get('email'), 'a+b@x.ua');
});
