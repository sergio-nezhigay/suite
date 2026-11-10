/** @jsxImportSource preact */
import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { EasyBuyCodBox } from './EasyBuyCodBox';

// Target: purchase.thank-you.block.render (the page right after checkout)
export default async () => {
  render(<App />, document.body);
};

// Payment types that can never be our COD ("Накладений платіж" is a manual payment method).
// Only the type is visible here, not the name, and the PrivatBank card transfer is also manual,
// so manual / on-delivery / other still need the backend check.
const NOT_COD_TYPES = new Set([
  'creditCard',
  'wallet',
  'redeemable',
  'offsite',
  'customOnsite',
  'deferred',
  'local',
]);

async function checkCodLocally(): Promise<boolean | null> {
  const types = shopify.selectedPaymentOptions.value.map((option) => option.type);
  if (types.length === 0) return null; // unknown → ask backend rather than hide a real COD box
  return types.every((type) => NOT_COD_TYPES.has(type)) ? false : null;
}

function App() {
  // Reading .value inside render subscribes the component to these signals
  const skus = shopify.lines.value.map((line) => line.merchandise.sku);
  const orderId = shopify.orderConfirmation.value?.order?.id;

  return (
    <EasyBuyCodBox
      skus={skus}
      orderId={orderId}
      storage={shopify.storage}
      checkCodLocally={checkCodLocally}
      getToken={() => shopify.sessionToken.get()}
      translate={(key) => shopify.i18n.translate(key)}
    />
  );
}
