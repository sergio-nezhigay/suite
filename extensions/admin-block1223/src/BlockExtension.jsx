import { useEffect, useState } from 'react';
import {
  Badge,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Divider,
  Heading,
  reactExtension,
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
  const [selectedTemplate, setSelectedTemplate] = useState([]);
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

  const handleSendSms = async () => {
    const receiverNumber = '380507025777'; // Fixed receiver number
    if (selectedTemplate.length === 0) {
      setSmsStatus('Please select a template to send.');
      return;
    }

    setLoading(true);
    setSmsStatus('Sending SMS...');
    try {
      const response = await sendSmsMessage(
        receiverNumber,
        selectedTemplate[0]
      );
      setSmsStatus(`Success: ${JSON.stringify(response)}`);
    } catch (err) {
      setSmsStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <BlockStack spacing='loose'>
      <Heading>SMS Control Center</Heading>

      {/* InlineStack to arrange buttons in a row with controlled spacing */}
      <InlineStack spacing='tight' wrap={false} alignment='center'>
        {smsTemplates.map((template) => (
          <Button
            key={template.id}
            onPress={() => {
              setSelectedTemplate([template.smsText]);
              handleSendSms();
            }}
            disabled={loading}
            variant='primary' // Use the primary variant to make buttons stand out
            tone='default' // Default tone for normal button
          >
            {loading ? 'Sending...' : template.title}
          </Button>
        ))}
      </InlineStack>

      <Divider />

      <BlockStack spacing='tight'>
        <Text fontWeight='bold'>Status:</Text>
        <Badge
          status={
            smsStatus.startsWith('Success')
              ? 'success'
              : smsStatus.startsWith('Error')
              ? 'critical'
              : undefined
          }
        >
          {smsStatus}
        </Badge>
      </BlockStack>

      {error && <Text color='critical'>{error}</Text>}
    </BlockStack>
  );
}
