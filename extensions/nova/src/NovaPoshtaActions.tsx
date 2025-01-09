import { useState } from 'react';
import {
  AdminBlock,
  BlockStack,
  Text,
  Button,
  InlineStack,
  ProgressIndicator,
} from '@shopify/ui-extensions-react/admin';

import { OrderInfo, Warehouse } from './Nova';

function NovaPoshtaActions({
  warehouse,
  orderInfo,
}: {
  warehouse: Warehouse;
  orderInfo: OrderInfo;
}) {
  const backendBaseUrl = 'https://admin-action-block.gadget.app';
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleCreateDocument = async () => {
    const payload = {
      firstName: orderInfo?.firstName,
      lastName: orderInfo?.lastName,
      phone: orderInfo?.shippingPhone,
      email: orderInfo?.email,
      documentData: {
        PayerType: 'Recipient',
        PaymentMethod: 'Cash',
        CargoType: 'Parcel',
        VolumeGeneral: '0.1',
        Weight: '0.3',
        ServiceType: 'WarehouseWarehouse',
        SeatsAmount: '1',
        Description: `Комп'ютерні аксесуари`,
        Cost: '200',
        CitySender: '8d5a980d-391c-11dd-90d9-001a92567626',
        Sender: '6a11bc85-464d-11e8-8b24-005056881c6b',
        SenderAddress: '53102715-1c75-11e4-acce-0050568002cf',
        ContactSender: '72040cf9-0919-11e9-8b24-005056881c6b',
        SendersPhone: '380507025777',
        //CityRecipient: '8d5a980d-391c-11dd-90d9-001a92567626',
        RecipientAddress: warehouse.ref,
        ContactRecipient: '33a5aa3b-cda3-11ef-bcd0-48df37b921da',
        RecipientsPhone: '380997979789',
      },
    };

    await sendRequest(`${backendBaseUrl}/create-document`, payload);
  };

  const sendRequest = async (url: string, payload: object) => {
    try {
      setError(null);
      setLoading(true);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setResponse(JSON.stringify(data, null, 2));
      } else {
        setError(data.error || 'An error occurred.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminBlock title='Nova Poshta Sending'>
      <BlockStack>
        <InlineStack>
          <Button onClick={handleCreateDocument} disabled={loading}>
            Create Document
          </Button>
        </InlineStack>

        {loading && <ProgressIndicator size='base' />}

        {response && (
          <BlockStack>
            <Text>Response:</Text>
            <Text>{response}</Text>
          </BlockStack>
        )}

        {error && (
          <BlockStack>
            <Text>Error:</Text>
            <Text>{error}</Text>
          </BlockStack>
        )}
      </BlockStack>
    </AdminBlock>
  );
}

export default NovaPoshtaActions;
