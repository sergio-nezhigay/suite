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

const TARGET = 'admin.product-details.block.render';

export default reactExtension(TARGET, () => <App />);

function App() {
  const { close, data, intents } = useApi(TARGET);
  const [status, setStatus] = useState('Ready to send SMS'); // Renamed here
  const [smsTemplates, setSmsTemplates] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadSmsTemplates = async () => {
      try {
        const result = await fetchSmsTemplates();
        setSmsTemplates(result);
      } catch (err) {
        setStatus('Failed to fetch SMS templates'); // Renamed here
      }
    };

    loadSmsTemplates();
  }, []);

  const handleSendSms = async (templateText) => {
    const receiverNumber = '380507025777';
    const orderId = '12345';
    if (!templateText) {
      setStatus('Please select a template to send.'); // Renamed here
      return;
    }

    const processedTemplateText = replacePlaceholders(templateText, {
      orderId,
    });

    setLoading(true);
    setStatus('Sending SMS...'); // Renamed here
    try {
      const response = await sendSmsMessage(
        receiverNumber,
        processedTemplateText
      );

      const messageID = response?.smsResponse?.messageID;
      const date = response?.smsResponse?.sms?.date;

      if (messageID && date) {
        setStatus(
          `Success: Message sent successfully at ${date}. Message ID: ${messageID}`
        ); // Renamed here
      } else {
        setStatus(
          'Success: Message sent successfully, but details are not available.'
        ); // Renamed here
      }
    } catch (err) {
      setStatus(`Error: ${err.message}`); // Renamed here
    } finally {
      setLoading(false);
    }
  };

  return (
    <BlockStack blockAlignment='space-between'>
      <Heading size='2'>SMS Control Center2</Heading>
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
              status.startsWith('Success') // Updated condition
                ? 'success'
                : status.startsWith('Error') // Updated condition
                ? 'critical'
                : 'default'
            }
          >
            {status} {/* Updated here */}
          </Badge>
        </InlineStack>
      </BlockStack>
    </BlockStack>
  );
}
