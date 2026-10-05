/** @jsxImportSource preact */
import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { useState, useEffect, useMemo } from 'preact/hooks';

import { stages } from '../../shared/stages';

// Target: admin.order-index.selection-action.render (see ./shopify.extension.toml)
export default async () => {
  render(<App />, document.body);
};

interface LineItem {
  id: string;
  title: string;
  currentQuantity: number;
  variant?: {
    title: string;
    sku: string;
  };
  discountedUnitPriceSet: {
    shopMoney: {
      amount: string;
      currencyCode: string;
    };
  };
}

interface Order {
  id: string;
  name: string;
  createdAt: string;
  currentTotalPriceSet: {
    shopMoney: {
      amount: string;
    };
  };
  lineItems: {
    nodes: LineItem[];
  };
}

interface VerificationResult {
  orderId: string;
  orderName: string;
  orderAmount: number;
  orderDate: string;
  matchCount: number;
  // Check information
  checkIssued?: boolean;
  checkIssuedAt?: string;
  checkReceiptId?: string;
  checkFiscalCode?: string;
  checkReceiptUrl?: string;
  checkSkipped?: boolean;
  checkSkipReason?: string;
  matches: Array<{
    transactionId: string;
    amount: number;
    date: string | null;
    description: string;
  }>;
}

interface VerificationResponse {
  success: boolean;
  results: VerificationResult[];
  summary: {
    ordersChecked: number;
    transactionsScanned: number;
    ordersWithMatches: number;
  };
  error?: string;
}

function supplierCode2orderTag(supplierCode: string) {
  switch (supplierCode) {
    case 'РИ':
      return stages.RI;
    case 'ЧЕ':
      return stages.CHE;
    case 'Ме':
      return stages.ME;
    case 'ИИ':
      return stages.II;
    default:
      return 'Невідомий постачальник';
  }
}

function App() {
  const { close, data } = shopify;
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResults, setVerificationResults] = useState<VerificationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bestVariants, setBestVariants] = useState<Record<string, string>>({});
  const [variantsLoading, setVariantsLoading] = useState(false);

  const selectedOrderIds = useMemo(() =>
    data?.selected?.map((item: any) => item.id) || [],
    [data?.selected]
  );

  console.log('Selected orders data:', data);

  // Fetch order details using fetch (same as checks extension)
  useEffect(() => {
    (async function getOrdersInfo() {
      if (selectedOrderIds.length === 0) {
        setLoading(false);
        return;
      }

      const getOrdersQuery = {
        query: `query GetOrders($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Order {
              id
              name
              createdAt
              currentTotalPriceSet {
                shopMoney {
                  amount
                }
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
                  discountedUnitPriceSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                }
              }
            }
          }
        }`,
        variables: { ids: selectedOrderIds },
      };

      try {
        const res = await fetch('shopify:admin/api/graphql.json', {
          method: 'POST',
          body: JSON.stringify(getOrdersQuery),
        });

        if (!res.ok) {
          console.error('GraphQL request failed:', res.status);
          setLoading(false);
          return;
        }

        const ordersData = await res.json();

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

        console.log('Filtered orders:', filteredOrders);
        setOrders(filteredOrders);
      } catch (error) {
        console.error('Error fetching orders:', error);
        setOrders([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedOrderIds.join(',')]);

  // Fetch best variants when orders change
  useEffect(() => {
    if (orders.length > 0) {
      setVariantsLoading(true);
      fetchReceiptNames(orders).then(names => {
        setBestVariants(names);
        setVariantsLoading(false);
      });
    }
  }, [orders]);

  // Check names per line item id, computed by the backend
  const fetchReceiptNames = async (ordersToName: Order[]): Promise<Record<string, string>> => {
    try {
      const response = await fetch('/receiptNames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orders: ordersToName.map(order => ({
            id: order.id,
            lineItems: order.lineItems.nodes.map(item => ({
              id: item.id,
              title: item.title,
              // Same price as sent when issuing, so preview names match the check
              price: formatPrice(item.discountedUnitPriceSet.shopMoney.amount),
            })),
          })),
        }),
      });
      if (!response.ok) {
        console.log('Failed to fetch receipt names:', response.status);
        return {};
      }
      const data = await response.json();
      return data.names;
    } catch (error) {
      console.log('Error fetching receipt names:', error);
      return {};
    }
  };

  const truncateProductName = (name: string, maxLength: number = 40) => {
    return name.length > maxLength
      ? name.substring(0, maxLength) + '...'
      : name;
  };

  const formatPrice = (amount: string) => {
    return Math.round(parseFloat(amount)).toString();
  };

  const handleVerifyPayments = async () => {
    if (selectedOrderIds.length === 0) {
      setError('No orders selected');
      return;
    }

    setIsVerifying(true);
    setError(null);
    setVerificationResults(null);

    try {
      console.log('Verifying payments for orders:', selectedOrderIds);

      const orderData = orders.map(order => ({
        id: order.id,
        name: order.name,
        createdAt: order.createdAt,
        totalAmount: parseFloat(order.currentTotalPriceSet?.shopMoney?.amount || '0'),
        lineItems: order.lineItems.nodes.map(item => ({
          id: item.id,
          title: item.title,
          quantity: item.currentQuantity,
          price: formatPrice(item.discountedUnitPriceSet.shopMoney.amount),
        })),
      }));

      console.log('Sending order data with variants:', orderData);

      // Call the Gadget action directly via fetch
      const response = await fetch('/verifyOrderPayments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderIds: selectedOrderIds,
          orderData: orderData
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Verification result:', result);

      if (result.success) {
        setVerificationResults(result);
      } else {
        setError(result.error || 'Verification failed');
      }
    } catch (err) {
      console.error('Error verifying payments:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsVerifying(false);
    }
  };

  const getPaymentStatusBadge = (result: VerificationResult) => {
    if (result.matchCount > 0) {
      return (
        <s-badge tone='success'>✅ Payment Found</s-badge>
      );
    } else {
      return <s-badge tone='critical'>❌ No Payment</s-badge>;
    }
  };

  const getCheckStatusBadge = (result: VerificationResult) => {
    if (result.checkIssued) {
      return <s-badge tone='success'>🧾 Check Issued</s-badge>;
    } else if (result.checkSkipped) {
      return <s-badge tone='warning'>⏭️ Check Skipped</s-badge>;
    } else if (result.matchCount > 0) {
      return <s-badge tone='warning'>⏳ Check Pending</s-badge>;
    }
    return null;
  };

  const formatVerificationTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  };


  return (
    <s-admin-action
      heading={`Payment Verification for ${selectedOrderIds.length} order${
        selectedOrderIds.length === 1 ? '' : 's'
      }`}
    >
      <s-stack>
        {loading ? (
          <s-text>Loading order details...</s-text>
        ) : orders.length === 0 ? (
          <s-text>No orders found</s-text>
        ) : (
          <s-stack>
            <s-text type="strong">📦 Order Preview</s-text>
            {/* TODO: Add here also 1st order's sku */}


            {orders.map((order, index) => (
              <s-stack key={order.id}>
                <s-section heading={order.name + "->" + supplierCode2orderTag(order.lineItems.nodes[0].variant?.sku?.split('^')[1] || "")}> {/*supplier code*/}
                  <s-stack>
                    {/* Line Items */}
                    {order.lineItems.nodes.slice(0, 5).map((item, itemIndex) => {
                      const price = formatPrice(item.discountedUnitPriceSet.shopMoney.amount);

                      return (
                        <s-box key={itemIndex}>
                          <s-stack direction='inline'>
                            <s-box minInlineSize='45%'>
                              <s-text>{truncateProductName(item.title)}</s-text>
                            </s-box>
                            <s-box minInlineSize='20%'>
                              <s-text>{bestVariants[item.id] || '...'}</s-text>
                            </s-box>
                            <s-box minInlineSize='15%'>
                              <s-badge>{item.currentQuantity}</s-badge>
                            </s-box>
                            <s-box minInlineSize='20%'>
                              <s-text>₴{price}</s-text>
                            </s-box>
                          </s-stack>
                        </s-box>
                      );
                    })}
                    {order.lineItems.nodes.length > 5 && (
                      <s-box>
                        <s-text>
                          ...and {order.lineItems.nodes.length - 5} more items
                        </s-text>
                      </s-box>
                    )}
                  </s-stack>
                </s-section>
                {index < orders.length - 1 && <s-divider />}
              </s-stack>
            ))}
          </s-stack>
        )}

        {error && <s-text>❌ Error: {error}</s-text>}

        {isVerifying && (
          <s-text>🔄 Checking payments against recent bank transactions...</s-text>
        )}

        {verificationResults && (
          <s-stack>
            <s-text type="strong">📊 Verification Summary</s-text>
            <s-text>
              Orders Checked: {verificationResults.summary.ordersChecked}
            </s-text>
            <s-text>
              Transactions Scanned:{' '}
              {verificationResults.summary.transactionsScanned}
            </s-text>
            <s-text>
              Matches Found: {verificationResults.summary.ordersWithMatches}
            </s-text>

            <s-text type="strong">📋 Results by Order</s-text>
            <s-stack>
              {verificationResults.results.map((result) => (
                <s-stack key={result.orderId}>
                  <s-stack direction='inline'>
                    <s-text type="strong">{result.orderName}</s-text>
                    {getPaymentStatusBadge(result)}
                    {getCheckStatusBadge(result)}
                  </s-stack>

                  <s-text>Amount: ₴{result.orderAmount.toFixed(2)}</s-text>

                  {result.checkIssued && (
                    <s-stack>
                      <s-text type="strong">🧾 Fiscal Check Details:</s-text>
                      {result.checkReceiptId && (
                        <s-text>Receipt ID: {result.checkReceiptId}</s-text>
                      )}
                      {result.checkFiscalCode && result.checkFiscalCode !== 'N/A' && (
                        <s-text>Fiscal Code: {result.checkFiscalCode}</s-text>
                      )}
                      {result.checkReceiptUrl && result.checkReceiptUrl !== 'N/A' && (
                        <s-text>URL: {result.checkReceiptUrl}</s-text>
                      )}
                      {result.checkIssuedAt && (
                        <s-text>
                          Issued: {formatVerificationTime(result.checkIssuedAt)}
                        </s-text>
                      )}
                    </s-stack>
                  )}

                  {result.checkSkipped && (
                    <s-stack>
                      <s-text>⏭️ Check Creation Skipped</s-text>
                      <s-text>Reason: {result.checkSkipReason}</s-text>
                    </s-stack>
                  )}

                  {result.matches.length > 0 && (
                    <s-stack>
                      <s-text type="strong">✅ Matching Transactions:</s-text>
                      {result.matches.map((match) => (
                        <s-stack key={match.transactionId}>
                          <s-text>
                            💰 ₴{match.amount.toFixed(2)} on{' '}
                            {match.date ? new Date(match.date).toLocaleDateString() : '—'}
                          </s-text>
                          <s-text>
                            📝 {match.description.substring(0, 50)}
                          </s-text>
                        </s-stack>
                      ))}
                    </s-stack>
                  )}
                </s-stack>
              ))}
            </s-stack>
          </s-stack>
        )}
      </s-stack>
      <s-button
        slot='primary-action'
        onClick={handleVerifyPayments}
        disabled={
          isVerifying ||
          selectedOrderIds.length === 0 ||
          loading ||
          variantsLoading
        }
      >
        {isVerifying ? 'Verifying...' : 'Check Payments'}
      </s-button>
      <s-button slot='secondary-actions' onClick={close}>
        Close
      </s-button>
    </s-admin-action>
  );
}
