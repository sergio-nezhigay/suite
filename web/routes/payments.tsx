import { Page, Layout, Card, Text, IndexTable, Button, Badge, EmptyState } from '@shopify/polaris';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

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
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState<UncoveredPayment[]>([]);

  // Placeholder data structure - will be populated in Phase 3
  const mockPayments: UncoveredPayment[] = [];

  const resourceName = {
    singular: 'payment',
    plural: 'payments',
  };

  const rowMarkup = mockPayments.map(
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
        loading: loading,
        onAction: () => {
          setLoading(true);
          console.log('Refreshing payments data...');
          // Will be implemented in Phase 3
          setTimeout(() => setLoading(false), 1000);
        },
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

        <Layout.Section>
          <Card padding="0">
            {mockPayments.length === 0 ? (
              emptyStateMarkup
            ) : (
              <IndexTable
                resourceName={resourceName}
                itemCount={mockPayments.length}
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
