/** @jsxImportSource preact */
import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { updateOrdersTags } from '../../shared/shopifyOperations';

// Target: admin.order-index.selection-action.render (see ./shopify.extension.toml)
export default async () => {
  render(<App />, document.body);
};

interface Order {
  id: string;
  name: string;
  customer?: {
    displayName: string;
  };
  lineItems: {
    nodes: Array<{
      id: string;
      title: string;
      currentQuantity: number;
      variant?: {
        title: string;
        sku?: string;
      };
      originalUnitPriceSet: {
        shopMoney: {
          amount: string;
          currencyCode: string;
        };
      };
      discountedUnitPriceSet: {
        shopMoney: {
          amount: string;
          currencyCode: string;
        };
      };
    }>;
  };
  fulfillments: Array<{
    id: string;
    trackingInfo: Array<{
      number?: string;
    }>;
  }>;
  metafields: {
    nodes: Array<{
      id: string;
      namespace: string;
      key: string;
      value: string;
    }>;
  };
}

interface ReceiptResult {
  orderId: string;
  orderName?: string;
  success?: boolean;
  receiptId?: string;
  fiscalCode?: string;
  ettnNumber?: string;
  error?: string;
  details?: string;
}

function App() {
  const { data } = shopify;
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [receiptResults, setReceiptResults] = useState<ReceiptResult[]>([]);
  const [productVariantsCache, setProductVariantsCache] = useState<Record<string, string>>({});
  const [variantsLoading, setVariantsLoading] = useState(false);

  const selectedIds = data?.selected?.map(({ id }) => id) || [];
  useEffect(() => {
    (async function getOrdersInfo() {
      if (selectedIds.length === 0) {
        setLoading(false);
        return;
      }

      const getOrdersQuery = {
        query: `query GetOrders($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Order {
              id
              name
              customer {
                displayName
              }
              lineItems(first: 10) {
                nodes {
                  id
                  title
                  currentQuantity
                  variant {
                    title
                    sku
                  }
                  originalUnitPriceSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                  discountedUnitPriceSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                }
              }
              fulfillments(first: 5) {
                id
                trackingInfo(first: 10) {
                  number
                }
              }
              metafields(first: 10) {
                nodes {
                  id
                  namespace
                  key
                  value
                }
              }
            }
          }
        }`,
        variables: { ids: selectedIds },
      };

      try {
        const res = await fetch('shopify:admin/api/graphql.json', {
          method: 'POST',
          body: JSON.stringify(getOrdersQuery),
        });

        if (!res.ok) {
          setLoading(false);
          return;
        }

        const ordersData = await res.json();

        // Log for debugging
        console.log('GraphQL Response:', ordersData);

        if (ordersData.errors) {
          console.error('GraphQL Errors:', ordersData.errors);
        }

        // Filter out line items with currentQuantity of 0 (removed/refunded items)
        const filteredOrders = (ordersData.data?.nodes || []).map((order: Order) => ({
          ...order,
          lineItems: {
            nodes: order.lineItems.nodes.filter(item => item.currentQuantity > 0)
          }
        }));

        setOrders(filteredOrders);
      } catch (error) {
        console.error('Error fetching orders:', error);
        setOrders([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedIds.join(',')]);

  // Fetch variants when orders change
  useEffect(() => {
    if (orders.length > 0) {
      setVariantsLoading(true);
      const allProductTitles = new Set<string>();
      orders.forEach(order => {
        order.lineItems.nodes.forEach(item => {
          allProductTitles.add(item.title);
        });
      });

      if (allProductTitles.size > 0) {
        fetchBestVariants(Array.from(allProductTitles)).then(variants => {
          setProductVariantsCache(variants);
          setVariantsLoading(false);
        });
      } else {
        setVariantsLoading(false);
      }
    }
  }, [orders]);

  const formatPrice = (amount: string) => {
    return Math.round(parseFloat(amount)).toString();
  };

  const formatLineItemsWithPrices = (lineItems: Order['lineItems']) => {
    if (!lineItems?.nodes?.length) return [];
    return lineItems.nodes.slice(0, 5);
  };

  const truncateProductName = (name: string, maxLength: number = 40) => {
    return name.length > maxLength
      ? name.substring(0, maxLength) + '...'
      : name;
  };

  // Helper functions for fetching variants from backend
  const fetchBestVariant = async (productTitle: string): Promise<string> => {
    try {
      const response = await fetch(`/findBestVariant?productTitle=${encodeURIComponent(productTitle)}`);
      if (!response.ok) {
        console.log('Failed to fetch variant for:', productTitle);
        return '';
      }
      const data = await response.json();
      return data.bestVariant;
    } catch (error) {
      console.log('Error fetching variant for:', productTitle, error);
      return '';
    }
  };

  // For batch processing multiple titles at once
  const fetchBestVariants = async (productTitles: string[]): Promise<Record<string, string>> => {
    const variants: Record<string, string> = {};

    // Process in parallel for better performance
    const promises = productTitles.map(async (title) => {
      const variant = await fetchBestVariant(title);
      variants[title] = variant;
    });

    await Promise.all(promises);
    return variants;
  };


  const getPaymentMethod = (metafields: Order['metafields']) => {
    const paymentMethodField = metafields?.nodes?.find(
      (field) => field.namespace === 'custom' && field.key === 'payment_method'
    );
    const fullPaymentMethod = paymentMethodField?.value || 'Not specified';
    return fullPaymentMethod.split(' ')[0];
  };

  const getTrackingNumber = (fulfillments: Order['fulfillments']) => {
    // Get the first tracking number from the first fulfillment
    const trackingNumber = fulfillments?.[0]?.trackingInfo?.[0]?.number;
    return trackingNumber || null;
  };

  const handleProcessChecks = async () => {
    setProcessing(true);
    setReceiptResults([]);

    try {
      console.log('Creating Checkbox receipts for orders:', selectedIds);

      // Prepare order data with tracking numbers and product variants
      const orderData = orders.map(order => ({
        orderId: order.id,
        orderName: order.name,
        trackingNumber: getTrackingNumber(order.fulfillments),
        customer: order.customer?.displayName,
        lineItems: order.lineItems.nodes.map(item => ({
          title: item.title,
          variant: productVariantsCache[item.title],
          quantity: item.currentQuantity,
          // Use discounted price if available, fallback to original
          price: formatPrice(
            item.discountedUnitPriceSet.shopMoney.amount ||
            item.originalUnitPriceSet.shopMoney.amount
          )
        }))
      }));

      const response = await fetch('/createCheckboxReceipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: orderData }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setReceiptResults(data.results);

      // Update successfully processed orders to "Завершені" stage
      const successfulOrderIds = (data.results as ReceiptResult[])
        .filter((r) => r.success)
        .map((r) => r.orderId);

      if (successfulOrderIds.length > 0) {
        console.log('Updating order tags to Завершені for:', successfulOrderIds);
        await updateOrdersTags({ value: 'Завершені', orderIds: successfulOrderIds });
      }

      console.log('Checkbox receipts results:', data.results);
    } catch (error) {
      console.error('Error creating receipts:', error);
      setReceiptResults([
        {
          orderId: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      ]);
    } finally {
      setProcessing(false);
    }
  };

  const orderRowColumns = '35% 25% 40%';
  const lineItemColumns = '45% 15% 15% 25%';

  return (
    <s-admin-action
      heading={`Checks for ${selectedIds.length} selected order${
        selectedIds.length === 1 ? '' : 's'
      }`}
      loading={loading}
    >
      <s-button
        slot='primary-action'
        variant='primary'
        onClick={handleProcessChecks}
        disabled={loading || orders.length === 0 || processing || variantsLoading}
      >
        {processing ? 'Processing...' : variantsLoading ? 'Loading variants...' : 'Process Checks'}
      </s-button>
      <s-button slot='secondary-actions' onClick={() => shopify.close()}>
        Close
      </s-button>

      <s-stack direction='block' gap='base'>
        {loading ? (
          <s-text>Loading order details...</s-text>
        ) : orders.length === 0 ? (
          <s-text>No orders found</s-text>
        ) : (
          <s-stack direction='block' gap='base'>
            {orders.map((order, index) => (
              <s-stack key={order.id} direction='block' gap='small'>
                <s-heading>{order.name}</s-heading>

                {/* Order Summary */}
                <s-grid gridTemplateColumns={orderRowColumns} alignItems='center'>
                  <s-text>{order.customer?.displayName || 'Guest'}</s-text>
                  <s-box>
                    <s-badge>{getPaymentMethod(order.metafields)}</s-badge>
                  </s-box>
                  <s-text>{getTrackingNumber(order.fulfillments) || ''}</s-text>
                </s-grid>

                {/* Line Items */}
                {formatLineItemsWithPrices(order.lineItems).map(
                  (item, itemIndex) => {
                    const originalPrice = formatPrice(item.originalUnitPriceSet.shopMoney.amount);
                    const discountedPrice = formatPrice(item.discountedUnitPriceSet.shopMoney.amount);
                    const hasDiscount = originalPrice !== discountedPrice;

                    return (
                      <s-grid key={itemIndex} gridTemplateColumns={lineItemColumns} alignItems='start'>
                        <s-text>{truncateProductName(item.title)}</s-text>
                        <s-text>{productVariantsCache[item.title]}</s-text>
                        <s-box>
                          <s-badge>{item.currentQuantity}</s-badge>
                        </s-box>
                        {hasDiscount ? (
                          <s-stack direction='block' gap='small-200'>
                            <s-text color='subdued'>was {originalPrice}</s-text>
                            <s-box>
                              <s-badge tone='success'>{discountedPrice}</s-badge>
                            </s-box>
                          </s-stack>
                        ) : (
                          <s-text>{originalPrice}</s-text>
                        )}
                      </s-grid>
                    );
                  }
                )}
                {order.lineItems.nodes.length > 5 && (
                  <s-text>
                    ...and {order.lineItems.nodes.length - 5} more items
                  </s-text>
                )}
                {index < orders.length - 1 && <s-divider />}
              </s-stack>
            ))}
          </s-stack>
        )}

        {receiptResults.length > 0 && (
          <s-section heading='Receipt Results'>
            <s-stack direction='block' gap='base'>
              {receiptResults.map((result, index) => (
                <s-grid key={index} gridTemplateColumns='30% 70%' alignItems='start'>
                  <s-text type='strong'>{result.orderName || result.orderId}</s-text>
                  {result.success ? (
                    <s-stack direction='block' gap='small-200'>
                      <s-box>
                        <s-badge tone='success'>✓ Receipt Created</s-badge>
                      </s-box>
                      {result.fiscalCode && (
                        <s-text>Fiscal: {result.fiscalCode}</s-text>
                      )}
                      {result.ettnNumber && (
                        <s-text>ETTN: {result.ettnNumber}</s-text>
                      )}
                    </s-stack>
                  ) : (
                    <s-stack direction='block' gap='small-200'>
                      <s-banner tone='critical'>✗ {result.error}</s-banner>
                      {result.details && (
                        <s-text color='subdued'>{result.details}</s-text>
                      )}
                    </s-stack>
                  )}
                </s-grid>
              ))}
            </s-stack>
          </s-section>
        )}
      </s-stack>
    </s-admin-action>
  );
}
