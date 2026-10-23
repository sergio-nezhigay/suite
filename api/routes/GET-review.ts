import type { RouteHandler } from 'gadget-server';

// Target of the in-email review form (Brevo template 10). Old emails still use
// these field names. Personal data goes only in the hash, never in the query.
const SITE = 'https://informatica.com.ua';
const UTM = 'utm_source=brevo&utm_medium=email&utm_campaign=review_request';
const SHOP_DOMAIN = 'c2da09-15.myshopify.com';
const JUDGEME = 'https://judge.me/api/v1/reviews';

type ReviewInput = {
  rating?: number;
  productId?: string;
  handle?: string;
  name: string;
  email: string;
  body: string;
};

const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

function parseInput(query: unknown): ReviewInput {
  const q = (query ?? {}) as Record<string, unknown>;
  const rating = str(q.review_rating);
  const productId = str(q.product_id);
  const handle = str(q.product_handle);
  return {
    rating: /^[1-5]$/.test(rating) ? Number(rating) : undefined,
    productId: /^\d+$/.test(productId) ? productId : undefined,
    handle: /^[\p{L}\p{N}_-]+$/u.test(handle) ? handle : undefined,
    name: str(q.name),
    email: str(q.email),
    body: str(q.review_body),
  };
}

// The product page with the review widget hash; the theme reads and clears it.
function productUrl(handle: string, hashParts: (string | false)[]) {
  const page = `${SITE}/products/${encodeURIComponent(handle)}?${UTM}`;
  return [`${page}#judgeme_product_reviews`, ...hashParts.filter(Boolean)].join('&');
}

// The site form, prefilled. Without a handle there is no form: the plain home page.
const formUrl = ({ handle, rating, name, email }: ReviewInput) =>
  handle
    ? productUrl(handle, [
        !!rating && `rating=${rating}`,
        !!name && `name=${encodeURIComponent(name)}`,
        !!email && `email=${encodeURIComponent(email)}`,
      ])
    : `${SITE}/`;

const thanksUrl = (handle: string) => productUrl(handle, ['thanks=1']);

// Double taps arrive within a second, before Judge.me lists the first save.
const RECENT_MS = 2 * 60 * 1000;
const recent = new Map<string, number>();

function seenRecently(key: string) {
  const now = Date.now();
  for (const [k, at] of recent) if (now - at > RECENT_MS) recent.delete(k);
  const seen = recent.has(key);
  recent.set(key, now);
  return seen;
}

type JudgemeReview = { product_external_id?: number; reviewer?: { email?: string } };

async function alreadyReviewed(auth: string, email: string, productId: string) {
  const response = await fetch(
    `${JUDGEME}?${auth}&per_page=100&reviewer_email=${encodeURIComponent(email)}`
  );
  if (!response.ok) throw new Error(`Judge.me lookup failed: ${response.status}`);
  const { reviews = [] } = (await response.json()) as { reviews?: JudgemeReview[] };
  // Check both fields here: an ignored filter must not look like a duplicate.
  return reviews.some(
    (review) =>
      String(review.product_external_id) === productId &&
      review.reviewer?.email?.toLowerCase() === email.toLowerCase()
  );
}

const route: RouteHandler = async ({ request, reply, logger, api }) => {
  const input = parseInput(request.query);
  const { rating, productId, handle, name, email, body } = input;
  const redirect = (url: string) => reply.code(302).header('Location', url).send();

  if (!rating || !productId || !handle || !name || !email) {
    logger.warn({ rating, productId, handle }, 'Review request with bad input, sent to the site form');
    return redirect(formUrl(input));
  }

  const key = `${email.toLowerCase()}|${productId}`;
  try {
    // Judge.me saves an unknown product id as a published shop review.
    const product = await api.shopifyProduct.maybeFindOne(productId, { select: { id: true } });
    if (!product) {
      logger.warn({ productId, handle }, 'Review for an unknown product, sent to the site form');
      return redirect(formUrl(input));
    }
    const auth = `api_token=${process.env.JUDGEME_API_TOKEN}&shop_domain=${SHOP_DOMAIN}`;
    if (!seenRecently(key) && !(await alreadyReviewed(auth, email, productId))) {
      const response = await fetch(`${JUDGEME}?${auth}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: productId,
          name,
          email,
          rating,
          body,
          shop_domain: 'informatica.com.ua',
          platform: 'shopify',
          review_type: 'product',
          verified_buyer: true,
        }),
      });
      if (!response.ok) throw new Error(`Judge.me create failed: ${response.status}`);
    }
    return redirect(thanksUrl(handle));
  } catch (error) {
    recent.delete(key); // a failed save may be retried
    logger.error({ productId, message: (error as Error).message }, 'Review save failed, sent to the site form');
    return redirect(formUrl(input));
  }
};

export default route;
