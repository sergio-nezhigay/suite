import { useEffect, useState } from 'react';
import {
  Badge,
  BlockStack,
  InlineStack,
  Divider,
  Button,
  Heading,
  Text,
  reactExtension,
  ProgressIndicator,
  ButtonGroup,
  useApi,
} from '@shopify/ui-extensions-react/admin';

import { fetchSmsTemplates } from './fetchSmsTemplates';
import { sendSmsMessage } from './sendSmsMessage';
import { replacePlaceholders } from './replacePlaceholders';
import {
  getOrderInfo,
  getCustomerPhone,
  addOrderNote,
} from '../../shared/shopifyOperations';

const TARGET = 'admin.order-details.block.render';

export default reactExtension(TARGET, () => <App />);

function App() {
  const { data } = useApi(TARGET);
  const [status, setStatus] = useState('Loading...');
  const [smsTemplates, setSmsTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [customerPhone, setCustomerPhone] = useState('');
  const orderId = data?.selected[0]?.id;

  useEffect(() => {
    const loadSmsTemplates = async () => {
      try {
        const { tags, orderNumber, total, customerId } = await getOrderInfo(
          orderId
        );
        const results = await fetchSmsTemplates();
        const resultsProcessed = results.map((res) => ({
          ...res,
          smsTextReplaced: replacePlaceholders(res.smsText, {
            orderTotal: total,
            orderNumber,
          }),
        }));
        setSmsTemplates(resultsProcessed);
        const customerPhone = await getCustomerPhone(customerId);
        setCustomerPhone(customerPhone);
        setStatus('Ready to send SMS');
      } catch (err) {
        setStatus('Failed to fetch SMS templates' + JSON.stringify(err));
      }
    };
    loadSmsTemplates();
  }, []);

  const handleSendSms = async (smsText) => {
    setLoading(true);
    setStatus('Sending SMS...');
    try {
      const response = await sendSmsMessage(customerPhone, smsText);
      const note = `SMS sent ${smsText}`;
      await addOrderNote({ orderId, note });
      setStatus(note);
    } catch (err) {
      const note = `Error sending sms: ${err.message}`;
      await addOrderNote({ orderId, note });
      setStatus(note);
    } finally {
      setLoading(false);
    }
  };

  return (
    <BlockStack gap='large'>
      <InlineStack inlineAlignment='center' blockAlignment='center' gap='large'>
        {smsTemplates.map((template) => (
          <Button
            key={template.id}
            onPress={() => handleSendSms(template.smsTextReplaced)}
            disabled={loading}
            variant='primary'
            tone='default'
          >
            {template.title}
          </Button>
        ))}
      </InlineStack>

      <BlockStack>
        <InlineStack>
          {loading && <ProgressIndicator size='small-200' />}
          <Badge
            tone={
              status.startsWith('Success')
                ? 'success'
                : status.startsWith('Error')
                ? 'critical'
                : 'default'
            }
          >
            {status}
          </Badge>
        </InlineStack>
      </BlockStack>
    </BlockStack>
  );
}
