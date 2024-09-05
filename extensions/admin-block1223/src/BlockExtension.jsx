import { useEffect, useState } from 'react';
import {
  Badge,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Heading,
  reactExtension,
  ProgressIndicator,
  useApi,
} from '@shopify/ui-extensions-react/admin';
import { fetchSmsTemplates } from './fetchSmsTemplates';
import { sendSmsMessage } from './sendSmsMessage';
import { replacePlaceholders } from './replacePlaceholders';
import { getOrderInfo } from '../../shared/orderTagsOperations';

const TARGET = 'admin.order-details.block.render';

export default reactExtension(TARGET, () => <App />);

function App() {
  const { close, data, intents } = useApi(TARGET);
  const [status, setStatus] = useState('Loading...');
  const [smsTemplates, setSmsTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const orderId = data?.selected[0]?.id;

  useEffect(() => {
    const loadSmsTemplates = async () => {
      try {
        const { tags, orderNumber, total } = await getOrderInfo(orderId);
        const results = await fetchSmsTemplates();
        const resultsProcessed = results.map((res) => ({
          ...res,
          smsTextReplaced: replacePlaceholders(res.smsText, {
            orderTotal: total,
            orderNumber,
          }),
        }));
        setSmsTemplates(resultsProcessed);
        setStatus('Ready to send SMS2');
      } catch (err) {
        setStatus('Failed to fetch SMS templates' + JSON.stringify(err));
      }
    };

    loadSmsTemplates();
  }, []);

  const handleSendSms = async (smsText) => {
    const receiverNumber = '380507025777';
    if (!smsText) {
      setStatus('Please select a template to send.');
      return;
    }

    setLoading(true);
    setStatus('Sending SMS...');
    try {
      const response = await sendSmsMessage(receiverNumber, smsText);

      setStatus(`Success: Message sent successfully`);
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <BlockStack blockAlignment='space-between'>
      <Heading size='2'>SMS Control Center3</Heading>
      <InlineStack
        inlineAlignment='center'
        blockAlignment='center'
        gap='large'
        padding='true'
      >
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

      <BlockStack spacing='tight'>
        <Text fontWeight='bold'>Status:</Text>
        <InlineStack inlineAlignment='start' spacing='tight'>
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
