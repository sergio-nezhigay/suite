import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  reactExtension,
  useApi,
  AdminAction,
  BlockStack,
  Button,
  Text,
  InlineStack,
  Badge,
  Box,
  Section,
  Divider,
} from '@shopify/ui-extensions-react/admin';

const TARGET = 'admin.order-index.selection-action.render';

export default reactExtension(TARGET, () => <App />);

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
  lineItems: {
    nodes: LineItem[];
  };
}

interface VerificationResult {
  orderId: string;
  orderName: string;
  orderAmount: number;
  orderDate: string;
  financialStatus: string;
  matchCount: number;
  alreadyVerified?: boolean;
  verifiedAt?: string;
  matchConfidence?: number;
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
    date: string;
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

function App() {
  const { close, data } = useApi(TARGET);
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
      const allProductTitles = new Set<string>();
      orders.forEach(order => {
        order.lineItems.nodes.forEach(item => {
          allProductTitles.add(item.title);
        });
      });

      if (allProductTitles.size > 0) {
        fetchBestVariants(Array.from(allProductTitles)).then(variants => {
          setBestVariants(variants);
          setVariantsLoading(false);
        });
      } else {
        setVariantsLoading(false);
      }
    }
  }, [orders]);

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

      // Prepare order data with pre-calculated variants (same as checks extension)
      const orderData = orders.map(order => ({
        id: order.id,
        name: order.name,
        lineItems: order.lineItems.nodes.map(item => ({
          id: item.id,
          title: item.title,
          quantity: item.currentQuantity,
          price: formatPrice(item.discountedUnitPriceSet.shopMoney.amount),
          variant: bestVariants[item.title] || item.title // Use title as key, not id
        }))
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
    if (result.alreadyVerified) {
      return (
        <Badge tone='info'>
          🔒 Previously Verified ({result.matchConfidence}%)
        </Badge>
      );
    } else if (result.matchCount > 0) {
      return (
        <Badge tone='success'>✅ Payment Found ({result.matchCount})</Badge>
      );
    } else {
      return <Badge tone='critical'>❌ No Payment</Badge>;
    }
  };

  const getCheckStatusBadge = (result: VerificationResult) => {
    if (result.checkIssued) {
      return <Badge tone='success'>🧾 Check Issued</Badge>;
    } else if (result.checkSkipped) {
      return <Badge tone='warning'>⏭️ Check Skipped</Badge>;
    } else if (result.matchCount > 0) {
      return <Badge tone='warning'>⏳ Check Pending</Badge>;
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
    <AdminAction
      title={`Payment Verification for ${selectedOrderIds.length} order${
        selectedOrderIds.length === 1 ? '' : 's'
      }`}
      primaryAction={
        <Button
          onPress={handleVerifyPayments}
          disabled={isVerifying || selectedOrderIds.length === 0 || loading || variantsLoading}
        >
          {isVerifying ? 'Verifying...' : variantsLoading ? 'Loading variants...' : 'Check Payments'}
        </Button>
      }
      secondaryAction={<Button onPress={close}>Close</Button>}
    >
      <BlockStack>
        {loading ? (
          <Text>Loading order details...</Text>
        ) : orders.length === 0 ? (
          <Text>No orders found</Text>
        ) : (
          <BlockStack>
            <Text fontWeight='bold'>📦 Order Preview</Text>
            {/* TODO: Add here also 1st order's sku */}


            {orders.map((order, index) => (
              <BlockStack key={order.id}>
                <Section heading={order.name + "->" + order.lineItems.nodes[0].variant?.sku?.split('^')[1] || ""}> {/*supplier code*/}
                  <BlockStack>
                    {/* Line Items */}
                    {order.lineItems.nodes.slice(0, 5).map((item, itemIndex) => {
                      const price = formatPrice(item.discountedUnitPriceSet.shopMoney.amount);

                      return (
                        <Box key={itemIndex}>
                          <InlineStack>
                            <Box minInlineSize='45%'>
                              <Text>{truncateProductName(item.title)}</Text>
                            </Box>
                            <Box minInlineSize='20%'>
                              <Text>{bestVariants[item.title] || '...'}</Text>
                            </Box>
                            <Box minInlineSize='15%'>
                              <Badge>{item.currentQuantity}</Badge>
                            </Box>
                            <Box minInlineSize='20%'>
                              <Text>₴{price}</Text>
                            </Box>
                          </InlineStack>
                        </Box>
                      );
                    })}
                    {order.lineItems.nodes.length > 5 && (
                      <Box>
                        <Text>
                          ...and {order.lineItems.nodes.length - 5} more items
                        </Text>
                      </Box>
                    )}
                  </BlockStack>
                </Section>
                {index < orders.length - 1 && <Divider />}
              </BlockStack>
            ))}
          </BlockStack>
        )}

        {error && <Text>❌ Error: {error}</Text>}

        {isVerifying && (
          <Text>🔄 Checking payments against recent bank transactions...</Text>
        )}

        {verificationResults && (
          <BlockStack>
            <Text fontWeight='bold'>📊 Verification Summary</Text>
            <Text>
              Orders Checked: {verificationResults.summary.ordersChecked}
            </Text>
            <Text>
              Transactions Scanned:{' '}
              {verificationResults.summary.transactionsScanned}
            </Text>
            <Text>
              Matches Found: {verificationResults.summary.ordersWithMatches}
            </Text>

            <Text fontWeight='bold'>📋 Results by Order</Text>
            <BlockStack>
              {verificationResults.results.map((result) => (
                <BlockStack key={result.orderId}>
                  <InlineStack>
                    <Text fontWeight='bold'>{result.orderName}</Text>
                    {getPaymentStatusBadge(result)}
                    {getCheckStatusBadge(result)}
                  </InlineStack>

                  <Text>
                    Amount: ₴{result.orderAmount.toFixed(2)} | Status:{' '}
                    {result.financialStatus}
                  </Text>

                  {result.verifiedAt && (
                    <Text>
                      🕒{' '}
                      {result.alreadyVerified
                        ? 'Previously verified'
                        : 'Just verified'}
                      : {formatVerificationTime(result.verifiedAt)}
                    </Text>
                  )}

                  {result.checkIssued && (
                    <BlockStack>
                      <Text fontWeight='bold'>🧾 Fiscal Check Details:</Text>
                      {result.checkReceiptId && (
                        <Text>Receipt ID: {result.checkReceiptId}</Text>
                      )}
                      {result.checkFiscalCode && result.checkFiscalCode !== 'N/A' && (
                        <Text>Fiscal Code: {result.checkFiscalCode}</Text>
                      )}
                      {result.checkReceiptUrl && result.checkReceiptUrl !== 'N/A' && (
                        <Text>URL: {result.checkReceiptUrl}</Text>
                      )}
                      {result.checkIssuedAt && (
                        <Text>
                          Issued: {formatVerificationTime(result.checkIssuedAt)}
                        </Text>
                      )}
                    </BlockStack>
                  )}

                  {result.checkSkipped && (
                    <BlockStack>
                      <Text>⏭️ Check Creation Skipped</Text>
                      <Text>Reason: {result.checkSkipReason}</Text>
                    </BlockStack>
                  )}

                  {result.matches.length > 0 && (
                    <BlockStack>
                      <Text fontWeight='bold'>
                        {result.alreadyVerified
                          ? '🔒 Previously Matched Transactions:'
                          : '✅ Matching Transactions:'}
                      </Text>
                      {result.matches.map((match) => (
                        <BlockStack key={match.transactionId}>
                          <Text>
                            💰 ₴{match.amount.toFixed(2)} on{' '}
                            {new Date(match.date).toLocaleDateString()}
                          </Text>
                          <Text>
                            📝 {match.description.substring(0, 50)}...
                          </Text>
                          {result.alreadyVerified && (
                            <Text>
                              📊 Confidence: {result.matchConfidence}%
                            </Text>
                          )}
                        </BlockStack>
                      ))}
                    </BlockStack>
                  )}
                </BlockStack>
              ))}
            </BlockStack>
          </BlockStack>
        )}
      </BlockStack>
    </AdminAction>
  );
}
