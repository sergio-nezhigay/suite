/** @jsxImportSource preact */
import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { EasyBuyCodBox } from './EasyBuyCodBox';

// Target: customer-account.order-status.block.render (the order page opened later from the email)
export default async () => {
  render(<App />, document.body);
};

function App() {
  const skus = shopify.lines.value.map((line) => line.merchandise.sku);
  const orderId = shopify.order.value?.id;

  return (
    <EasyBuyCodBox
      skus={skus}
      orderId={orderId}
      getToken={() => shopify.sessionToken.get()}
      translate={(key) => shopify.i18n.translate(key)}
    />
  );
}
