/** @jsxImportSource preact */
import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { EasyBuyCodBox, isCodGatewayName } from './EasyBuyCodBox';

// Target: customer-account.order-status.block.render (the order page opened later from the email)
export default async () => {
  render(<App />, document.body);
};

const CUSTOMER_API_URL = 'shopify://customer-account/api/2026-07/graphql.json';

const ORDER_PAYMENT_QUERY = `
  query EasyBuyCodPayment($id: ID!) {
    order(id: $id) {
      transactions { typeDetails { name } }
    }
  }
`;

// Reads the payment name from Shopify's Customer Account API (no call to our backend).
// Only a positive match is trusted; anything else returns null, so the backend is asked once
// and its answer is saved.
function makeCheckCodLocally(orderId: string | undefined) {
  return async (): Promise<boolean | null> => {
    if (!orderId) return null;
    try {
      const res = await fetch(CUSTOMER_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: ORDER_PAYMENT_QUERY, variables: { id: orderId } }),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as {
        data?: {
          order?: { transactions?: { typeDetails?: { name?: string | null } | null }[] } | null;
        };
      };
      const transactions = json.data?.order?.transactions ?? [];
      return transactions.some((t) => isCodGatewayName(t.typeDetails?.name)) ? true : null;
    } catch {
      return null;
    }
  };
}

function App() {
  const skus = shopify.lines.value.map((line) => line.merchandise.sku);
  const orderId = shopify.order.value?.id;

  return (
    <EasyBuyCodBox
      skus={skus}
      orderId={orderId}
      storage={shopify.storage}
      checkCodLocally={makeCheckCodLocally(orderId)}
      getToken={() => shopify.sessionToken.get()}
      translate={(key) => shopify.i18n.translate(key)}
    />
  );
}
