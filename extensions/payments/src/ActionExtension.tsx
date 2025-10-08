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
} from '@shopify/ui-extensions-react/admin';

const TARGET = 'admin.order-index.selection-action.render';

export default reactExtension(TARGET, () => <App />);

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

interface LineItem {
  id: string;
  title: string;
  quantity: number;
  price: {
    amount: string;
    currencyCode: string;
  };
  variant?: {
    title: string;
  };
}

interface OrderDetails {
  id: string;
  name: string;
  lineItems: {
    nodes: LineItem[];
  };
}

function App() {
  const { close, data, query } = useApi(TARGET);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResults, setVerificationResults] =
    useState<VerificationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orderDetails, setOrderDetails] = useState<OrderDetails[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [bestVariants, setBestVariants] = useState<{ [key: string]: string }>({});

  console.log('Selected orders data:', data);

  const selectedOrderIds = useMemo(() =>
    data?.selected?.map((item: any) => item.id) || [],
    [data?.selected]
  );

  const fetchOrderDetails = useCallback(async (orderIds: string[]) => {
    if (orderIds.length === 0) {
      setOrderDetails([]);
      return;
    }

    setIsLoadingDetails(true);
    try {
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
                  quantity
                  price {
                    amount
                    currencyCode
                  }
                  variant {
                    title
                  }
                }
              }
            }
          }
        }`,
        variables: { ids: orderIds },
      };

      console.log('Fetching orders with query:', getOrdersQuery);
      const result = await query(getOrdersQuery.query, { variables: getOrdersQuery.variables });
      console.log('Query result:', result);

      const orders = (result as any)?.data?.nodes?.filter((node: any) => node?.id) || [];
      setOrderDetails(orders);
    } catch (err) {
      console.error('Error fetching order details:', err);
      setError('Failed to load order details');
    } finally {
      setIsLoadingDetails(false);
    }
  }, [query]);

  const fetchBestVariants = useCallback(async (orders: OrderDetails[]) => {
    const variants: { [key: string]: string } = {};

    try {
      for (const order of orders) {
        for (const item of order.lineItems.nodes) {
          if (!variants[item.id] && item.title) {
            const response = await fetch(`/findBestVariant?productTitle=${encodeURIComponent(item.title)}`);
            if (response.ok) {
              const result = await response.json();
              variants[item.id] = result.bestVariant;
            }
          }
        }
      }
      setBestVariants(variants);
    } catch (err) {
      console.error('Error fetching best variants:', err);
    }
  }, []);

  useEffect(() => {
    fetchOrderDetails(selectedOrderIds);
  }, [selectedOrderIds, fetchOrderDetails]);

  useEffect(() => {
    if (orderDetails.length > 0) {
      fetchBestVariants(orderDetails);
    }
  }, [orderDetails, fetchBestVariants]);

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

      // Prepare order data with pre-calculated variants
      const orderData = orderDetails.map(order => ({
        id: order.id,
        name: order.name,
        lineItems: order.lineItems.nodes.map(item => ({
          id: item.id,
          title: item.title,
          quantity: item.quantity,
          price: item.price.amount, // Send just the amount as string
          variant: bestVariants[item.id] || item.title // Use pre-calculated variant or fallback to original title
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
          orderData: orderData // Include the pre-calculated order data
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
      primaryAction={
        <Button
          onPress={handleVerifyPayments}
          disabled={isVerifying || selectedOrderIds.length === 0}
        >
          {isVerifying ? 'Verifying...' : 'Check Payments'}
        </Button>
      }
      secondaryAction={<Button onPress={close}>Close</Button>}
    >
      <BlockStack>
        <Text fontWeight='bold'>💰 Payment Verification</Text>

        <Text>Selected Orders: {selectedOrderIds.length}</Text>

        {isLoadingDetails && <Text>🔄 Loading order details...</Text>}

        {!isLoadingDetails && orderDetails.length > 0 && (
          <BlockStack>
            <Text fontWeight='bold'>📋 Order Line Items:</Text>
            {orderDetails.map((order) => (
              <BlockStack key={order.id}>
                <Text fontWeight='bold'>{order.name}</Text>
                {order.lineItems.nodes.map((item) => (
                  <BlockStack key={item.id}>
                    <InlineStack>
                      <Text>• {item.title} {item.variant?.title ? `(${item.variant.title})` : ''} - Qty: {item.quantity}</Text>
                    </InlineStack>
                    {bestVariants[item.id] && bestVariants[item.id] !== item.title && (
                      <Text>
                        ↳ Best Match: {bestVariants[item.id]}
                      </Text>
                    )}
                  </BlockStack>
                ))}
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
