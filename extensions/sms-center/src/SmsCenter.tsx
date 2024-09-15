import React from 'react';

import { useEffect, useState } from 'react';
import {
  Badge,
  BlockStack,
  InlineStack,
  Button,
  reactExtension,
  ProgressIndicator,
  useApi,
} from '@shopify/ui-extensions-react/admin';

import {
  getOrderInfo,
  getCustomerPhone,
  addOrderNote,
} from '../../shared/shopifyOperations';

import { replacePlaceholders } from './utils/replacePlaceholders';
import { sendSmsMessage } from './utils/sendSmsMessage';
import { fetchSmsTemplates } from './utils/fetchSmsTemplates';
import { GadgetRecord } from '.gadget/client/types';

const TARGET = 'admin.order-details.block.render';

export default reactExtension(TARGET, () => <App />);

import { SmsTemplates } from '.gadget/client/types';

type SmsTemplate = SmsTemplates & {
  smsTextReplaced: string;
};

function App() {
  const { data } = useApi(TARGET);
  const [status, setStatus] = useState('Loading...');
  const [smsTemplates, setSmsTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const orderId = data?.selected[0]?.id;

  useEffect(() => {
    const loadSmsTemplates = async () => {
      try {
        const { orderNumber, total, customerId } = await getOrderInfo(orderId);

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
      } catch (err: any) {
        setStatus(`Error in fetch: ${err.message || err.toString()}`);
      }
    };
    loadSmsTemplates();
  }, []);

  const handleSendSms = async (smsText: string) => {
    setLoading(true);
    setStatus('Sending SMS...');
    try {
      await sendSmsMessage(customerPhone, smsText);
      const note = `Success, SMS sent ${smsText}`;
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
            size='small-100'
          >
            {status.slice(0, 90)}
          </Badge>
        </InlineStack>
      </BlockStack>
    </BlockStack>
  );
}
