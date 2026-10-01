/** @jsxImportSource preact */
import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';

import { getOrderInfo, addOrderNote } from '../../shared/shopifyOperations';

import { replacePlaceholders } from './utils/replacePlaceholders';
import { sendSmsMessage } from './utils/sendSmsMessage';
import { fetchSmsTemplates } from './utils/fetchSmsTemplates';

// Target: admin.order-details.block.render (see ./shopify.extension.toml)
export default async () => {
  render(<App />, document.body);
};

function App() {
  const { data } = shopify;
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
    <s-admin-block>
      <s-stack gap='large'>
        <s-text>
          {customerPhone
            ? `Телефон клієнта:: ${customerPhone}`
            : 'Телефон клієнта не знайдено'}
        </s-text>

        {customerPhone && (
          <s-stack gap='base'>
            <s-stack direction='inline' gap='base'>
              <s-link
                href={`https://msng.link/o/?${customerPhone}=vi`}
                target='_blank'
                tone='auto'
              >
                Viber
              </s-link>
            </s-stack>
            <s-text>Текст: "{generateContextMessage()}"</s-text>
          </s-stack>
        )}

        <s-stack direction='inline' justifyContent='center' alignItems='center' gap='large'>
          {smsTemplates.map((template) => (
            <s-button
              key={template.id}
              onClick={() => handleSendSms(template.smsTextReplaced)}
              disabled={loading || status !== 'Ready to send SMS'}
              variant='primary'
              tone='auto'
            >
              {template.title}
            </s-button>
          ))}
        </s-stack>

        <s-stack>
          <s-stack direction='inline'>
            {loading && <s-spinner />}
            <s-badge
              tone={
                status.startsWith('Success')
                  ? 'success'
                  : status.startsWith('Error')
                  ? 'critical'
                  : undefined
              }
              size='base'
            >
              {status.slice(0, 90)}
            </s-badge>
          </s-stack>
        </s-stack>
      </s-stack>
    </s-admin-block>
  );
}
