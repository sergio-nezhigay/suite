import { useEffect, useState } from 'react';
import {
  Badge,
  BlockStack,
  InlineStack,
  Button,
  reactExtension,
  ProgressIndicator,
  useApi,
  Text,
  Link,
} from '@shopify/ui-extensions-react/admin';

import { getOrderInfo, addOrderNote } from '../../shared/shopifyOperations';

import { replacePlaceholders } from './utils/replacePlaceholders';
import { sendSmsMessage } from './utils/sendSmsMessage';
import { fetchSmsTemplates } from './utils/fetchSmsTemplates';

const TARGET = 'admin.order-details.block.render';

export default reactExtension(TARGET, () => <App />);

function App() {
  const { data } = useApi(TARGET);
  const [status, setStatus] = useState('Loading...');
  const [smsTemplates, setSmsTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const orderId = data?.selected[0]?.id;

  useEffect(() => {
    const loadSmsTemplates = async () => {
      try {
        const orderInfo = await getOrderInfo(orderId);
        const orderDetails = orderInfo?.orderDetails;
        const results = await fetchSmsTemplates();
        const resultsProcessed = results.map((res) => ({
          ...res,
          smsTextReplaced: replacePlaceholders(res.smsText, {
            orderTotal: orderDetails?.total || '',
            orderNumber: orderDetails?.orderNumber || '',
          }),
        }));
        setSmsTemplates(resultsProcessed);
        setOrderDetails(orderDetails);

        if (!orderDetails?.shippingPhone) {
          setStatus('Phone not found');
        } else {
          setCustomerPhone(orderDetails?.shippingPhone);
          setStatus('Ready to send SMS');
        }
      } catch (err: any) {
        setStatus(`Error in fetch: ${err.message || err.toString()}`);
      }
    };
    loadSmsTemplates();
  }, [orderId]);

  const handleSendSms = async (smsText: string) => {
    setLoading(true);
    setStatus('Sending SMS...');
    try {
      const orderName = orderDetails?.orderNumber;
      const response = await sendSmsMessage(customerPhone, smsText, orderName);
      console.log('🚀 ~ response:', JSON.stringify(response));
      if (response.status === 'error') {
        throw new Error(response.error);
      }

      const note = `Success: SMS sent "${smsText}"`;
      await addOrderNote({ orderId, note });
      setStatus(note);
    } catch (error) {
      const note = `Error sending sms: ${(error as Error).message}`;
      await addOrderNote({ orderId, note });
      setStatus(note);
    } finally {
      setLoading(false);
    }
  };

  const generateContextMessage = () => {
    if (!orderDetails) return '';

    const productName = orderDetails.lineItems?.[0]?.title || '';
    const orderNumber = orderDetails.orderNumber || '';

    return `Доброго дня! Це магазин informatica.com.ua щодо вашого замовлення ${`${orderNumber} `}на товар "${productName}"`;
  };

  return (
    <BlockStack gap='large'>
      <Text>
        {customerPhone
          ? `Телефон клієнта: ${customerPhone}`
          : 'Телефон клієнта не знайдено'}
      </Text>

      {customerPhone && (
        <BlockStack gap='base'>
          <InlineStack gap='base'>
            <Link
              href={`https://msng.link/o/?${customerPhone}=vi`}
              target='_blank'
              tone='default'
            >
              Viber
            </Link>
          </InlineStack>
          <Text>Текст: "{generateContextMessage()}"</Text>
        </BlockStack>
      )}

      <InlineStack inlineAlignment='center' blockAlignment='center' gap='large'>
        {smsTemplates.map((template) => (
          <Button
            key={template.id}
            onPress={() => handleSendSms(template.smsTextReplaced)}
            disabled={loading || status !== 'Ready to send SMS'}
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
                : undefined
            }
            size='small-100'
          >
            {status.slice(0, 90)}
          </Badge>
        </InlineStack>
      </BlockStack>
    </BlockStack>
  );
}
