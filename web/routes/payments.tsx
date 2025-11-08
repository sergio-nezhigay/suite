import { Page, Layout, Card, Text, IndexTable, Button, Badge, EmptyState, Banner, Modal, DataTable, Toast, Frame } from '@shopify/polaris';
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

interface PreviewItem {
  code: string;
  name: string;
  quantity: number;
  priceUAH: number;
  totalUAH: number;
}

export default function Payments() {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<UncoveredPayment[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Preview modal state
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [previewTotal, setPreviewTotal] = useState(0);
  const [currentPayment, setCurrentPayment] = useState<UncoveredPayment | null>(null);

  // Toast state
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastError, setToastError] = useState(false);

  // Track which payment is being issued
  const [issuingPaymentId, setIssuingPaymentId] = useState<string | null>(null);

  // Use Gadget hook to fetch uncovered payments
  const [{ data, fetching, error }, getPayments] = useGlobalAction(api.getUncoveredPayments);

  // Use Gadget hook to preview check
  const [{ data: previewData, fetching: previewFetching, error: previewError }, previewCheck] = useGlobalAction(api.previewCheckForPayment);

  // Use Gadget hook to issue check
  const [{ data: issueData, fetching: issueFetching, error: issueError }, issueCheck] = useGlobalAction(api.issueCheckForPayment);

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

  // Handle preview data
  useEffect(() => {
    if (previewData?.success && previewData?.items) {
      console.log('[Payments UI] Preview data received:', previewData.items.length, 'items');
      setPreviewItems(previewData.items);
      setPreviewTotal(previewData.totalAmountUAH);
      setPreviewModalOpen(true);
    }
  }, [previewData]);

  // Handle preview errors
  useEffect(() => {
    if (previewError) {
      console.error('[Payments UI] Preview error:', previewError);
      setErrorMessage(previewError.message || 'Failed to preview check');
    }
  }, [previewError]);

  // Handle issue check data
  useEffect(() => {
    if (issueData) {
      console.log('[Payments UI] Issue check response:', issueData);

      if (issueData.success) {
        // Show success toast
        setToastMessage(`Check issued successfully! Receipt ID: ${issueData.receiptId}`);
        setToastError(false);
        setToastActive(true);

        // Refresh payments list
        fetchPayments();
      } else {
        // Show error toast
        setToastMessage(issueData.error || 'Failed to issue check');
        setToastError(true);
        setToastActive(true);
      }

      setIssuingPaymentId(null);
    }
  }, [issueData]);

  // Handle issue check errors
  useEffect(() => {
    if (issueError) {
      console.error('[Payments UI] Issue check error:', issueError);
      setToastMessage(issueError.message || 'Failed to issue check');
      setToastError(true);
      setToastActive(true);
      setIssuingPaymentId(null);
    }
  }, [issueError]);

  const fetchPayments = async () => {
    try {
      console.log('[Payments UI] Fetching uncovered payments...');
      await getPayments({});
    } catch (err) {
      console.error('[Payments UI] Error:', err);
      setErrorMessage('Failed to fetch payments');
    }
  };

  const handlePreview = async (payment: UncoveredPayment) => {
    try {
      console.log('[Payments UI] Previewing check for payment:', payment.id);
      setCurrentPayment(payment);
      await previewCheck({
        transactionId: payment.id,
        amount: payment.amount,
      });
    } catch (err) {
      console.error('[Payments UI] Preview error:', err);
      setErrorMessage('Failed to preview check');
    }
  };

  const closePreviewModal = () => {
    setPreviewModalOpen(false);
    setPreviewItems([]);
    setPreviewTotal(0);
    setCurrentPayment(null);
  };

  const handleIssueCheck = async (payment: UncoveredPayment) => {
    try {
      console.log('[Payments UI] Issuing check for payment:', payment.id);
      setIssuingPaymentId(payment.id);

      await issueCheck({
        transactionId: payment.id,
        amount: payment.amount,
      });
    } catch (err) {
      console.error('[Payments UI] Issue check error:', err);
      setToastMessage('Failed to issue check');
      setToastError(true);
      setToastActive(true);
      setIssuingPaymentId(null);
    }
  };

  const toggleToastActive = () => setToastActive((active) => !active);

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
            <Button
              size="slim"
              onClick={() => handlePreview(payment)}
              loading={previewFetching && currentPayment?.id === payment.id}
            >
              Preview
            </Button>
            <Button
              size="slim"
              variant="primary"
              onClick={() => handleIssueCheck(payment)}
              loading={issueFetching && issuingPaymentId === payment.id}
            >
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

  const toastMarkup = toastActive ? (
    <Toast
      content={toastMessage}
      onDismiss={toggleToastActive}
      error={toastError}
    />
  ) : null;

  return (
    <Frame>
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

      {/* Preview Modal */}
      <Modal
        open={previewModalOpen}
        onClose={closePreviewModal}
        title={`Check Preview - ${currentPayment?.counterpartyName || 'Payment'}`}
        primaryAction={{
          content: 'Close',
          onAction: closePreviewModal,
        }}
      >
        <Modal.Section>
          {currentPayment && (
            <div style={{ marginBottom: '16px' }}>
              <Text variant="bodyMd" as="p">
                <strong>Payment Amount:</strong> {currentPayment.amount} UAH
              </Text>
              <Text variant="bodyMd" as="p">
                <strong>Transaction Date:</strong> {currentPayment.date}
              </Text>
              <Text variant="bodyMd" as="p">
                <strong>Account Code:</strong> {currentPayment.accountCode}
              </Text>
            </div>
          )}

          <Text variant="headingMd" as="h3">
            Check Items
          </Text>
          <div style={{ marginTop: '12px' }}>
            <DataTable
              columnContentTypes={['text', 'text', 'numeric', 'numeric', 'numeric']}
              headings={['Code', 'Product Name', 'Qty', 'Price (UAH)', 'Total (UAH)']}
              rows={previewItems.map((item) => [
                item.code,
                item.name,
                item.quantity,
                item.priceUAH.toFixed(2),
                item.totalUAH.toFixed(2),
              ])}
            />
          </div>

          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f6f6f7', borderRadius: '8px' }}>
            <Text variant="bodyLg" as="p" fontWeight="bold">
              Total Amount: {previewTotal.toFixed(2)} UAH
            </Text>
            {currentPayment && Math.abs(previewTotal - currentPayment.amount) <= 1 ? (
              <Text variant="bodyMd" as="p" tone="success">
                ✓ Amount verified
              </Text>
            ) : (
              <Text variant="bodyMd" as="p" tone="critical">
                ⚠ Amount mismatch detected
              </Text>
            )}
          </div>
        </Modal.Section>
      </Modal>

      {toastMarkup}
      </Page>
    </Frame>
  );
}
