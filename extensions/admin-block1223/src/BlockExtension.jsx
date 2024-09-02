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

const TARGET = 'admin.product-details.block.render';

export default reactExtension(TARGET, () => <App />);

function App() {
  const { close, data, intents } = useApi(TARGET);
  const [smsStatus, setSmsStatus] = useState('Ready to send SMS');
  const [smsTemplates, setSmsTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadSmsTemplates = async () => {
      try {
        const result = await fetchSmsTemplates();
        setSmsTemplates(result);
      } catch (err) {
        setError('Failed to fetch SMS templates');
      }
    };

    loadSmsTemplates();
  }, []);

  const handleSendSms = async (templateText) => {
    const receiverNumber = '380507025777';
    if (!templateText) {
      setSmsStatus('Please select a template to send.');
      return;
    }

    setLoading(true);
    setSmsStatus('Sending SMS...');
    try {
      const response = await sendSmsMessage(receiverNumber, templateText);
      setSmsStatus('Success: Message sent successfully.');
    } catch (err) {
      setSmsStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <BlockStack blockAlignment='space-between'>
      <Heading size='2'>SMS Control Center</Heading>
      <InlineStack
        inlineAlignment='center'
        blockAlignment='center'
        gap='large'
        padding='true'
      >
        {smsTemplates.map((template) => (
          <Button
            key={template.id}
            onPress={() => handleSendSms(template.smsText)}
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
              smsStatus.startsWith('Success')
                ? 'success'
                : smsStatus.startsWith('Error')
                ? 'critical'
                : 'default'
            }
          >
            {smsStatus}
          </Badge>
        </InlineStack>
      </BlockStack>

      {error && <Text color='critical'>{error}</Text>}
    </BlockStack>
  );
}
