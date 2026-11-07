/** @jsxImportSource preact */
import '@shopify/ui-extensions/preact';
import { useEffect, useState } from 'preact/hooks';
import { SHOPIFY_APP_URL } from '../../shared/data';

const EASYBUY_SKU_SUFFIX = '^ИИ';
const TIMEOUT_MS = 5000;

export interface BoxInput {
  skus: (string | undefined)[];
  orderId: string | undefined;
  getToken: () => Promise<string>;
  translate: (key: string) => string;
}

export function isEasyBuyOnly(skus: (string | undefined)[]): boolean {
  return skus.length > 0 && skus.every((sku) => (sku ?? '').endsWith(EASYBUY_SKU_SUFFIX));
}

// Shows nothing unless the backend confirms COD + EasyBuy-only. Any error or timeout → nothing.
export function EasyBuyCodBox({ skus, orderId, getToken, translate }: BoxInput) {
  const [show, setShow] = useState(false);
  const easyBuyOnly = isEasyBuyOnly(skus);

  useEffect(() => {
    if (!easyBuyOnly || !orderId) return;
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${SHOPIFY_APP_URL}/easybuy-cod-check`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `ShopifySessionToken ${token}`,
          },
          body: JSON.stringify({ orderId }),
          signal: controller.signal,
        });
        const data = res.ok ? await res.json() : null;
        if (!cancelled) setShow(data?.show === true);
      } catch {
        if (!cancelled) setShow(false);
      } finally {
        clearTimeout(timer);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [easyBuyOnly, orderId]);

  if (!show) return null;

  return (
    <s-banner heading={translate('heading')} tone="success">
      <s-paragraph>{translate('body')}</s-paragraph>
    </s-banner>
  );
}
