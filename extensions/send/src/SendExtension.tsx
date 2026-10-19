/** @jsxImportSource preact */
import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { useEffect, useState, useMemo } from 'preact/hooks';

import {
  fetchOrdersData,
  OrderResponse,
  tagAndNoteOrders,
} from '../../shared/shopifyOperations';
import { fetchWithTimeout } from '../../shared/makeGraphQLQuery';
import { SHOPIFY_APP_URL } from '../../shared/data';

type SendStep = 'sheet' | 'email' | 'warranty' | 'tagging';

const STEP_LABELS: Record<SendStep, string> = {
  sheet: 'Google Sheet',
  email: 'email',
  warranty: 'warranty email',
  tagging: 'tagging',
};

// Above the backend's own timeouts, so the server can answer with a clear error first
const ROUTE_TIMEOUT_MS = 30000;

// How long the success message stays visible before the modal closes itself
const AUTO_CLOSE_MS = 2000;

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function postToApp(path: string, body: unknown, label: string) {
  const response = await fetchWithTimeout(
    `${SHOPIFY_APP_URL}/${path}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    ROUTE_TIMEOUT_MS,
    label
  );
  if (!response.ok) throw new Error(`${label} failed (${response.status})`);
}

// Target: admin.order-index.selection-action.render (see ./shopify.extension.toml)
export default async () => {
  render(<SendExtension />, document.body);
};

function SendExtension() {
  const [loading, setLoading] = useState<boolean>(true);
  const [sent, setSent] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [step, setStep] = useState<SendStep | null>(null);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<SendStep[]>([]);
  const [ordersContent, setOrdersContent] = useState<
    OrderResponse['nodes'] | null
  >(null);
  const { data } = shopify;
  const selectedOrders = data?.selected || [];
  const selectedIds = useMemo(
    () => selectedOrders.map(({ id }: { id: string }) => id),
    [selectedOrders]
  );

  useEffect(() => {
    console.log('Fetching orders for:', selectedIds);
    async function fetchOrdersContent() {
      try {
        const orders = await fetchOrdersData(selectedIds);

        setOrdersContent(orders);
        setError(null);
      } catch (error) {
        console.error('Failed to fetch orders content:', error);
        setError(getErrorMessage(error, 'Failed to fetch orders'));
      } finally {
        setLoading(false);
      }
    }
    fetchOrdersContent();
  }, [selectedIds]);
  const firstOrderTag = ordersContent?.[0]?.tags?.[0] || '';
  console.log('firstOrderTag', JSON.stringify(firstOrderTag, null, 2));

  let spreadsheetId = '';
  let sheetName = 'Sheet2';
  let recipientEmail = '';
  let shouldSendWarrantyEmail = false;
  let shouldAutoTag = false;
  let shouldSendEmail = false;
  let tagStrategy:
    | string
    | ((order: OrderResponse['nodes'][number]) => string) = COMPLETED_TAG;

  if (firstOrderTag.includes('Ии')) {
    // Easy supplier
    spreadsheetId = '1DIDI_GIIehGNRADrOCZXOlPwyXvh4hkHSKkO79GaIIM';
    sheetName = 'Відправки';
    recipientEmail = 'deni-ua@ukr.net';
    shouldAutoTag = true;
    shouldSendEmail = true;
    tagStrategy = COMPLETED_TAG;
  } else if (firstOrderTag.includes('РІ')) {
    // Rizka supplier
    spreadsheetId = '1Tb8YTGBhAONP0QXrsCohbsNF3TEN58zXQ785l20o7Ic';
    recipientEmail = 'asd1134@ukr.net';
    shouldAutoTag = true;
    shouldSendEmail = true;
    tagStrategy = COMPLETED_TAG;
  } else if (firstOrderTag.includes('Че')) {
    // Cherg supplier
    spreadsheetId = '17J3L12ZHz3VoYp2la5dTcCmZg4-zcNZpCUyvifgLZkk';
    recipientEmail = 'scherginets@ukr.net';
    shouldAutoTag = true;
    shouldSendWarrantyEmail = true;
    shouldSendEmail = true;
    tagStrategy = COMPLETED_TAG;
  } else if (firstOrderTag.includes('Ме')) {
    spreadsheetId = '1jHwJA0U9XXSu1W66P7WOSuNiCMLvdMtXyTnPOOVQLP4';
    sheetName = 'Sheet1';
    shouldAutoTag = true;
    tagStrategy = COMPLETED_TAG;
  }

  const getTitle = () => {
    if (error) return error;
    if (loading) return 'Loading orders...';
    if (sending) {
      const stepLabel = step ? STEP_LABELS[step] : 'starting';
      const count =
        step === 'tagging'
          ? ` ${progress?.done ?? 0}/${progress?.total ?? selectedIds.length}`
          : '';
      return `Sending… step: ${stepLabel}${count}`;
    }
    if (sent) return `Orders sent (${selectedIds.length} processed)`;

    const baseTitle = firstOrderTag
      ? `Send "${firstOrderTag}" orders`
      : 'Send orders';

    return `${baseTitle} (${selectedIds.length} selected)`;
  };

  const handleSend = async () => {
    setError(null);
    setSending(true);
    setProgress({ done: 0, total: ordersContent!.length });
    // Tracked locally too: the `step` state is stale inside this closure
    let currentStep: SendStep = 'sheet';
    const completed: SendStep[] = [];
    const problems: string[] = [];

    const runStep = async (name: SendStep, fn: () => Promise<void>) => {
      currentStep = name;
      setStep(name);
      const startedAt = Date.now();
      console.log(`[send] step "${name}" started`);
      await fn();
      console.log(`[send] step "${name}" done in ${Date.now() - startedAt}ms`);
      completed.push(name);
    };

    // For steps after the supplier already has the orders: a failure is
    // reported, but the remaining steps still run
    const runFollowUpStep = async (name: SendStep, fn: () => Promise<void>) => {
      try {
        await runStep(name, fn);
      } catch (error) {
        console.error(`[send] step "${name}" failed:`, error);
        // Messages already name the step (postToApp label, tagging count)
        problems.push(getErrorMessage(error, `${STEP_LABELS[name]} failed`));
      }
    };

    try {
      // Delivery to the supplier: a failure stops the run
      try {
        await runStep('sheet', () =>
          postToApp(
            'appendRowsToSheet',
            { rows: convertOrdersToRows(ordersContent!), spreadsheetId, sheetName },
            'Google Sheet'
          )
        );
        if (shouldSendEmail) {
          await runStep('email', () =>
            postToApp(
              'send-email',
              {
                recipientEmail,
                cc: 'nezhihai@gmail.com',
                subject: 'Замовлення, кількість: ' + ordersContent!.length,
                htmlContent: generateOrdersHtmlTable(ordersContent!),
              },
              'email'
            )
          );
        }
      } catch (error) {
        console.error(`[send] step "${currentStep}" failed:`, error);
        // Names the failed step, so a retry doesn't duplicate what already went out
        setError(
          `Stuck at "${STEP_LABELS[currentStep]}": ${getErrorMessage(error, 'Failed to send orders')}`
        );
        return;
      }

      if (shouldSendWarrantyEmail) {
        await runFollowUpStep('warranty', () =>
          postToApp(
            'emailWarrantyCards',
            { subject: 'Order Details', ordersContent },
            'warranty email'
          )
        );
      }
      if (shouldAutoTag) {
        await runFollowUpStep('tagging', () =>
          autoTagProcessedOrders(ordersContent!, tagStrategy, (done, total) =>
            setProgress({ done, total })
          )
        );
      }

      // Sent either way, so the button stays disabled and nothing is sent twice
      setSent(true);
      setCompletedSteps(completed);
      if (problems.length > 0) {
        // Stays open so the failure gets noticed
        setError(`Failed: ${problems.join('; ')}`);
        return;
      }
      // Action modals can't show toasts, so show the success message, then close
      setTimeout(() => shopify.close(), AUTO_CLOSE_MS);
    } finally {
      setSending(false);
      setStep(null);
      setProgress(null);
    }
  };

  return (
    <s-admin-action heading={getTitle()}>
      <s-stack>
        {sending && <s-spinner />}
        {sent && !error ? (
          <s-banner tone='info' heading='✓ Done'>
            {completedSteps.map((step) => STEP_LABELS[step]).join(', ')}: done.
            Closing…
          </s-banner>
        ) : loading ? (
          <s-spinner />
        ) : ordersContent && ordersContent.length > 0 ? (
          <s-stack>
            {ordersContent.map((order, orderIndex) => (
              <OrderDetails
                key={order.id}
                order={order}
                orderIndex={orderIndex}
                ordersContent={ordersContent}
              />
            ))}
          </s-stack>
        ) : (
          <s-text>No orders content available</s-text>
        )}
      </s-stack>
      <s-button
        slot='primary-action'
        onClick={handleSend}
        disabled={loading || !ordersContent || sent || sending}
      >
        {sent ? '✓ Done' : sending ? 'Sending…' : 'Add to Google Sheet'}
      </s-button>
    </s-admin-action>
  );
}

type OrderDetailsProps = {
  order: OrderResponse['nodes'][number];
  orderIndex: number;
  ordersContent: OrderResponse['nodes'];
};

function OrderDetails({ order, orderIndex, ordersContent }: OrderDetailsProps) {
  const phone = getOrderPhone(order);
  const totalSum = order.lineItems.nodes.reduce((sum, lineItem) => {
    const price = parseFloat(lineItem.discountedUnitPriceSet.shopMoney.amount);
    return sum + price * lineItem.unfulfilledQuantity;
  }, 0);

  return (
    <s-stack gap='base'>
      <s-text>
        {order.paymentMetafield?.value}: {totalSum.toFixed(0)}
      </s-text>
      {order.lineItems.nodes.map((lineItem, index) => {
        const { barcode, cost } = getBarcodeAndCost(lineItem);
        const price = parseFloat(
          lineItem.discountedUnitPriceSet.shopMoney.amount
        );
        const delta = lineItem.unfulfilledQuantity * (price - cost) || 0;
        const title = removeBarcodeFromTitle(
          lineItem.title,
          lineItem.variant?.barcode
        );

        return (
          <s-stack key={index}>
            <s-text>
              {formatOrderDetails(
                title,
                barcode,
                lineItem.unfulfilledQuantity,
                price,
                cost,
                delta
              )}
            </s-text>
          </s-stack>
        );
      })}
      <s-text>
        т. {phone},{' '}
        {order.shippingAddress?.firstName || order.customer.firstName}{' '}
        {order.shippingAddress?.lastName || order.customer.lastName},
        {order.shippingAddress?.city}, {order.shippingAddress?.address1}
      </s-text>

      {orderIndex < ordersContent.length - 1 && <s-text>_________</s-text>}
    </s-stack>
  );
}

function getOrderPhone(order: OrderResponse['nodes'][number]): string {
  return order.shippingAddress.phone || order.phone || '!!!!! Error';
}

type LineItem = OrderResponse['nodes'][number]['lineItems']['nodes'][number];

function getBarcodeAndCost(lineItem: LineItem) {
  const customBarcode =
    lineItem.customAttributes.find((attr) => attr.key === '_barcode')?.value ||
    '';
  const customCost = parseFloat(
    lineItem.customAttributes.find((attr) => attr.key === '_cost')?.value || '0'
  );
  const cost =
    customCost ||
    parseFloat(lineItem.variant?.inventoryItem?.unitCost?.amount || '0');
  const barcode = (
    lineItem.variant?.barcode?.trim()
      ? lineItem.variant.barcode
      : customBarcode || ''
  ).toUpperCase();

  return { barcode, cost };
}

function formatOrderDetails(
  title: string,
  barcode: string,
  quantity: number,
  price: number,
  cost: number,
  delta: number
) {
  return `${title} ${
    barcode ? `(${barcode.toUpperCase()})` : ''
  } | ${quantity}шт | ${price.toFixed(0)} `;
  //  return `${title} ${
  //    barcode ? `(${barcode.toUpperCase()})` : ''
  //  } | ${quantity}шт | ${price.toFixed(0)} | ${cost.toFixed(
  //    0
  //  )} | ${delta.toFixed(0)}`;
}

function removeBarcodeFromTitle(
  title: string,
  barcode?: string | null
): string {
  if (!barcode) return title;
  const regex = new RegExp(barcode, 'ig');
  return title
    .replace(/\(\)/g, '')
    .trim()
    .replace(regex, '')
    .trim()
    .slice(0, 40);
}

function convertOrdersToRows(orders: OrderResponse['nodes']) {
  return [...orders]
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((order) => {
      const currentDate = new Date().toISOString().split('T')[0];
      return order.lineItems.nodes.map((lineItem, index) => {
        const { barcode, cost } = getBarcodeAndCost(lineItem);
        const price = parseFloat(
          lineItem.discountedUnitPriceSet.shopMoney.amount
        );
        const delta = lineItem.unfulfilledQuantity * (price - cost);
        const title = removeBarcodeFromTitle(lineItem.title, barcode);

        return [
          currentDate,
          order.name,
          index === 0 ? getOrderPhone(order) : '',
          index === 0
            ? order.shippingAddress?.firstName || order.customer.firstName
            : '',
          index === 0
            ? order.shippingAddress?.lastName || order.customer.lastName
            : '',
          index === 0 ? order.shippingAddress.city : '',
          index === 0 ? order.shippingAddress.address1 : '',
          title,
          barcode,
          lineItem.unfulfilledQuantity,
          price.toFixed(0),
          cost.toFixed(0),
          delta.toFixed(0),
          index === 0 ? order.paymentMetafield?.value || '' : '',
        ];
      });
    });
}

function generateOrdersHtmlTable(orders: OrderResponse['nodes']) {
  if (!orders || orders.length === 0) return '<p>No orders.</p>';

  const rows = [...orders]
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((order) => {
      return order.lineItems.nodes.map((lineItem, index) => {
        const { barcode, cost } = getBarcodeAndCost(lineItem);
        const price = parseFloat(
          lineItem.discountedUnitPriceSet.shopMoney.amount
        );
        const delta = lineItem.unfulfilledQuantity * (price - cost);
        return {
          orderName: index === 0 ? order.name : '',
          phone: index === 0 ? getOrderPhone(order) : '',
          firstName:
            index === 0
              ? order.shippingAddress?.firstName || order.customer.firstName
              : '',
          lastName:
            index === 0
              ? order.shippingAddress?.lastName || order.customer.lastName
              : '',
          city: index === 0 ? order.shippingAddress?.city : '',
          address: index === 0 ? order.shippingAddress?.address1 : '',
          title: removeBarcodeFromTitle(
            lineItem.title,
            lineItem.variant?.barcode
          ),
          barcode,
          quantity: lineItem.unfulfilledQuantity,
          price: price.toFixed(0),
          cost: cost.toFixed(0),
          delta: delta.toFixed(0),
          payment: index === 0 ? order.paymentMetafield?.value || '' : '',
        };
      });
    });

  const header = [
    'Order',
    'Phone',
    'First Name',
    'Last Name',
    'City',
    'Address',
    'Product',
    'Barcode',
    'Qty',
    'Price',
    'Cost',
    'Delta',
    'Payment',
  ];

  // Create a mapping from header names to object properties
  const keyMap: { [key: string]: string } = {
    Order: 'orderName',
    Phone: 'phone',
    'First Name': 'firstName',
    'Last Name': 'lastName',
    City: 'city',
    Address: 'address',
    Product: 'title',
    Barcode: 'barcode',
    Qty: 'quantity',
    Price: 'price',
    Cost: 'cost',
    Delta: 'delta',
    Payment: 'payment',
  };

  const thead = `<thead><tr>${header
    .map((h) => `<th>${h}</th>`)
    .join('')}</tr></thead>`;
  const tbody = `<tbody>${rows
    .map(
      (row) =>
        `<tr>${header
          .map((key) => `<td>${(row as any)[keyMap[key]] ?? ''}</td>`)
          .join('')}</tr>`
    )
    .join('')}</tbody>`;

  return `<table border="1" cellpadding="4" cellspacing="0">${thead}${tbody}</table>`;
}

// Tag strategies
const COMPLETED_TAG = 'Завершені';

// Reusable auto-tagging function
async function autoTagProcessedOrders(
  orders: OrderResponse['nodes'],
  tagStrategy: string | ((order: OrderResponse['nodes'][number]) => string),
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const items = orders.map((order) => {
    const tag =
      typeof tagStrategy === 'function' ? tagStrategy(order) : tagStrategy;
    console.log(`Auto-tagging order ${order.name} with: ${tag}`);
    return {
      orderId: order.id,
      tag,
      note: `Order sent to supplier. Tagged as: ${tag}`,
    };
  });

  const failed = await tagAndNoteOrders(items);
  onProgress?.(orders.length, orders.length);
  if (failed.length > 0) {
    throw new Error(`Failed to tag ${failed.length} of ${orders.length} orders`);
  }
}
