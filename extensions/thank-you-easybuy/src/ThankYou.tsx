/** @jsxImportSource preact */
import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { EasyBuyCodBox } from './EasyBuyCodBox';

// Target: purchase.thank-you.block.render (the page right after checkout)
export default async () => {
  render(<App />, document.body);
};

function App() {
  // Reading .value inside render subscribes the component to these signals
  const skus = shopify.lines.value.map((line) => line.merchandise.sku);
  const orderId = shopify.orderConfirmation.value?.order?.id;

  return (
    <EasyBuyCodBox
      skus={skus}
      orderId={orderId}
      getToken={() => shopify.sessionToken.get()}
      translate={(key) => shopify.i18n.translate(key)}
    />
  );
}
