import { useState } from 'react';
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
  const { close, data, query } = useApi(TARGET);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResults, setVerificationResults] =
    useState<VerificationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  console.log('Selected orders data:', data);

  const selectedOrderIds = data?.selected?.map((item: any) => item.id) || [];

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

      // Call the Gadget action directly via fetch
      const response = await fetch('/api/verifyOrderPayments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderIds: selectedOrderIds,
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
        <Badge tone='success'>✅ Payment Found ({result.matchCount})</Badge>
      );
    } else {
      return <Badge tone='critical'>❌ No Payment</Badge>;
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
                    Amount: ${result.orderAmount.toFixed(2)} | Status:{' '}
                    {result.financialStatus}
                  </Text>

                  {result.matches.length > 0 && (
                    <BlockStack>
                      <Text fontWeight='bold'>✅ Matching Transactions:</Text>
                      {result.matches.map((match) => (
                        <BlockStack key={match.transactionId}>
                          <Text>
                            💰 ${match.amount.toFixed(2)} on{' '}
                            {new Date(match.date).toLocaleDateString()}
                          </Text>
                          <Text>
                            📝 {match.description.substring(0, 50)}...
                          </Text>
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
