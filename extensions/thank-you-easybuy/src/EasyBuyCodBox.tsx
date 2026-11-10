/** @jsxImportSource preact */
import '@shopify/ui-extensions/preact';
import { useEffect, useState } from 'preact/hooks';
import { SHOPIFY_APP_URL } from '../../shared/data';

const EASYBUY_SKU_SUFFIX = '^ИИ';
export const COD_GATEWAY = 'накладений';
const TIMEOUT_MS = 5000;
const CACHE_PREFIX = 'easybuy-cod:';

// Minimal shape shared by checkout and customer-account `shopify.storage`
export interface KeyValueStorage {
  read<T = unknown>(key: string): Promise<T | null>;
  write(key: string, data: any): Promise<void>;
}

export interface BoxInput {
  skus: (string | undefined)[];
  orderId: string | undefined;
  storage: KeyValueStorage;
  // Decides COD for this order. Returns true/false, or null when it can't tell
  // (then we ask the Gadget backend once and remember the answer).
  checkCodLocally: () => Promise<boolean | null>;
  getToken: () => Promise<string>;
  translate: (key: string) => string;
}

export function isEasyBuyOnly(skus: (string | undefined)[]): boolean {
  return skus.length > 0 && skus.every((sku) => (sku ?? '').endsWith(EASYBUY_SKU_SUFFIX));
}

export function isCodGatewayName(name: string | null | undefined): boolean {
  return (name ?? '').toLowerCase().includes(COD_GATEWAY);
}

// Both pages share one numeric key (thank-you gives OrderIdentity/<n>, order page Order/<n>)
function cacheKey(orderId: string): string | null {
  const numericId = orderId.match(/(\d+)$/)?.[1];
  return numericId ? `${CACHE_PREFIX}${numericId}` : null;
}

async function askBackend(orderId: string, getToken: () => Promise<string>): Promise<boolean | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
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
    if (!res.ok) return null;
    const data = await res.json();
    return data?.show === true;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Shows the box only for EasyBuy-only COD orders. Any error or timeout → nothing.
// Order of checks, cheapest first: SKUs (client) → saved answer → local check → Gadget (once per order).
export function EasyBuyCodBox({
  skus,
  orderId,
  storage,
  checkCodLocally,
  getToken,
  translate,
}: BoxInput) {
  const [show, setShow] = useState(false);
  const easyBuyOnly = isEasyBuyOnly(skus);

  useEffect(() => {
    if (!easyBuyOnly || !orderId) return;
    let cancelled = false;
    const key = cacheKey(orderId);

    (async () => {
      try {
        if (key) {
          const saved = await storage.read<boolean>(key).catch(() => null);
          if (typeof saved === 'boolean') {
            if (!cancelled) setShow(saved);
            return;
          }
        }

        let isCod = await checkCodLocally().catch(() => null);
        if (isCod === null) {
          // The backend also re-checks the SKUs server-side
          isCod = await askBackend(orderId, getToken);
        }
        if (isCod === null) return; // error/timeout: show nothing, don't remember

        if (key) await storage.write(key, isCod).catch(() => undefined);
        if (!cancelled) setShow(isCod);
      } catch {
        if (!cancelled) setShow(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [easyBuyOnly, orderId]);

  if (!show) return null;

  return (
    <s-banner heading={translate('heading')} tone="success">
      <s-paragraph>{translate('body')}</s-paragraph>
    </s-banner>
  );
}
