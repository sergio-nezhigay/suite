import { Page, Layout, Card, Text, IndexTable, Button, Badge, EmptyState, Banner } from '@shopify/polaris';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useGlobalAction } from '@gadgetinc/react';
import { api } from '../api';

interface UncoveredPayment {
  id: string;
  date: string;
  amount: number;
  counterpartyName: string;
  accountCode: string;
  daysAgo: number;
  transactionId: string;
}

export default function Payments() {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<UncoveredPayment[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Use Gadget hook to fetch uncovered payments
  const [{ data, fetching, error }, getPayments] = useGlobalAction(api.getUncoveredPayments);

  // Fetch payments on component mount
  useEffect(() => {
    fetchPayments();
  }, []);

  // Update payments when data changes
  useEffect(() => {
    if (data?.success && data?.payments) {
      console.log('[Payments UI] Received payments:', data.payments.length);
      setPayments(data.payments);
      setErrorMessage(null);
    }
  }, [data]);

  // Handle errors
  useEffect(() => {
    if (error) {
      console.error('[Payments UI] Error fetching payments:', error);
      setErrorMessage(error.message || 'Failed to fetch payments');
    }
  }, [error]);

  const fetchPayments = async () => {
    try {
      console.log('[Payments UI] Fetching uncovered payments...');
      await getPayments({});
    } catch (err) {
      console.error('[Payments UI] Error:', err);
      setErrorMessage('Failed to fetch payments');
    }
  };

  const resourceName = {
    singular: 'payment',
    plural: 'payments',
  };

  const rowMarkup = payments.map(
    (payment, index) => (
      <IndexTable.Row
        id={payment.id}
        key={payment.id}
        position={index}
      >
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" as="span">
            {payment.date}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" as="span">
            {payment.amount} UAH
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" as="span">
            {payment.counterpartyName}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone="info">{payment.accountCode}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" as="span">
            {payment.daysAgo} days ago
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button size="slim" onClick={() => console.log('Preview', payment.id)}>
              Preview
            </Button>
            <Button size="slim" variant="primary" onClick={() => console.log('Issue Check', payment.id)}>
              Issue Check
            </Button>
          </div>
        </IndexTable.Cell>
      </IndexTable.Row>
    ),
  );

  const emptyStateMarkup = (
    <EmptyState
      heading="No uncovered payments"
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>There are no payments with restricted codes that need check issuance.</p>
    </EmptyState>
  );

  return (
    <Page
      title="Payment Verification & Check Issuance"
      backAction={{
        content: 'Back',
        onAction: () => navigate('/'),
      }}
      primaryAction={{
        content: 'Refresh',
        loading: fetching,
        onAction: fetchPayments,
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <Text as="p" variant="bodyMd">
              This page shows incoming payments from the last 7 days with restricted account codes (2600, 2902, 2909, 2920) that haven't been covered with Checkbox checks.
            </Text>
          </Card>
        </Layout.Section>

        {errorMessage && (
          <Layout.Section>
            <Banner tone="critical" title="Error loading payments">
              <p>{errorMessage}</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card padding="0">
            {fetching ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <Text variant="bodyMd" as="p">Loading payments...</Text>
              </div>
            ) : payments.length === 0 ? (
              emptyStateMarkup
            ) : (
              <IndexTable
                resourceName={resourceName}
                itemCount={payments.length}
                headings={[
                  { title: 'Transaction Date' },
                  { title: 'Amount' },
                  { title: 'Counterparty Name' },
                  { title: 'Account Code' },
                  { title: 'Days Ago' },
                  { title: 'Actions' },
                ]}
                selectable={false}
              >
                {rowMarkup}
              </IndexTable>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
