import { useState, useCallback } from 'react';
import {
  AdminBlock,
  BlockStack,
  Text,
  Button,
  InlineStack,
  ProgressIndicator,
  Badge,
} from '@shopify/ui-extensions-react/admin';

import { OrderInfo } from '../../shared/shopifyOperations';
import { SHOPIFY_APP_URL } from '../../shared/data';

interface NovaPoshtaActionsProps {
  orderInfo: OrderInfo;
  setOrderInfo: (info: OrderInfo) => void;
}

function NovaPoshtaActions({
  orderInfo,
  setOrderInfo,
}: NovaPoshtaActionsProps) {
  const [statusMessage, setStatusMessage] = useState<{
    message: string;
    type: 'success' | 'error' | null;
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleCreateDocument = useCallback(async () => {
    setStatusMessage(null);
    setLoading(true);

    try {
      const { declarationNumber, declarationRef } =
        await createDocumentNovaPoshta(buildPayload(orderInfo));

      await updateShopifyMetafields(
        orderInfo?.orderDetails?.id || '',
        declarationNumber,
        declarationRef
      );
      if (!orderInfo) return;
      setOrderInfo?.({
        ...orderInfo,
        novaposhtaDeclaration: {
          number: declarationNumber,
          ref: declarationRef,
        },
      });

      setStatusMessage({ message: 'Декларацію створено', type: 'success' });
    } catch (error) {
      setStatusMessage({
        message: error instanceof Error ? error.message : 'Unknown error',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [orderInfo, setOrderInfo]);

  const handleCancelDeclaration = useCallback(async () => {
    setStatusMessage(null);
    setLoading(true);

    try {
      const response = await fetch(
        `${SHOPIFY_APP_URL}/nova-poshta/cancel-document`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            DocumentRefs: orderInfo?.novaposhtaDeclaration?.ref || '',
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Не вдалося скасувати декларацію.');
      }

      if (!orderInfo) return;
      setOrderInfo({
        ...orderInfo,
        novaposhtaDeclaration: {
          number: '',
          ref: '',
        },
      });
      setStatusMessage({ message: 'Декларацію скасовано', type: 'success' });
    } catch (error) {
      setStatusMessage({
        message: error instanceof Error ? error.message : 'Unknown error',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [orderInfo, setOrderInfo]);

  return (
    <AdminBlock title='Nova Poshta Sending'>
      <BlockStack rowGap='base'>
        {orderInfo?.novaposhtaDeclaration?.number ? (
          <InlineStack inlineAlignment='space-between' blockAlignment='center'>
            <Text>
              Номер декларації: {orderInfo.novaposhtaDeclaration.number}
            </Text>
            <Button onClick={handleCancelDeclaration} disabled={loading}>
              Скасувати декларацію
            </Button>
          </InlineStack>
        ) : (
          <Button onClick={handleCreateDocument} disabled={loading}>
            Створити декларацію
          </Button>
        )}

        {loading && <ProgressIndicator size='base' />}

        {statusMessage && (
          <Badge
            tone={statusMessage.type === 'error' ? 'critical' : 'success'}
            size='base'
          >
            {statusMessage.message}
          </Badge>
        )}
      </BlockStack>
    </AdminBlock>
  );
}

export default NovaPoshtaActions;

export async function createDocumentNovaPoshta(payload: object) {
  try {
    const res = await fetch(`${SHOPIFY_APP_URL}/nova-poshta/create-document`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data.error ||
          'An error occurred while processing the Nova Poshta request.'
      );
    }

    return {
      declarationNumber: data.data[0].IntDocNumber,
      declarationRef: data.data[0].Ref,
    };
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Unknown error');
  }
}

function buildPayload(orderInfo: OrderInfo) {
  const baseDocumentData = {
    PayerType: 'Recipient',
    PaymentMethod: 'Cash',
    CargoType: 'Parcel',
    ServiceType: 'WarehouseWarehouse',
    SeatsAmount: '1',
    OptionsSeat: [
      {
        volumetricWidth: '10',
        volumetricLength: '10',
        volumetricHeight: '4',
        weight: '0.3',
      },
    ],
    Description: `Комп`ютерні аксесуари`,
    Cost: orderInfo?.orderDetails?.total,
    CitySender: 'db5c88d9-391c-11dd-90d9-001a92567626', // Буча
    Sender: 'ad3dbd0e-ae6c-11ec-92e7-48df37b921da', // СШ
    //Sender: '6a11bc85-464d-11e8-8b24-005056881c6b', // СН getCounterparties /ref result
    //SenderAddress: 'd81f61a9-72f9-11ec-81d3-b8830365bd14', // №5
    SenderAddress: '84a24ee3-4d6e-11ee-9eb1-d4f5ef0df2b8', // №6
    ContactSender: 'ad3e51f3-ae6c-11ec-92e7-48df37b921da', // СШ
    //ContactSender: '72040cf9-0919-11e9-8b24-005056881c6b', // СН getCounterpartyContactPersons result
    SendersPhone: '380632570653',
    CityRecipient: orderInfo?.novaposhtaRecepientWarehouse?.cityRef,
    RecipientAddress: orderInfo?.novaposhtaRecepientWarehouse?.warehouseRef,
    RecipientsPhone: orderInfo?.orderDetails?.shippingPhone,
  };

  return {
    firstName: orderInfo?.orderDetails?.firstName,
    lastName: orderInfo?.orderDetails?.lastName,
    phone: orderInfo?.orderDetails?.shippingPhone,
    email: orderInfo?.orderDetails?.email,
    documentData:
      orderInfo?.orderDetails?.paymentMethod === 'Передплата безготівка'
        ? baseDocumentData
        : {
            ...baseDocumentData,
            BackwardDeliveryData: [
              {
                PayerType: 'Recipient',
                CargoType: 'Money',
                RedeliveryString: orderInfo?.orderDetails?.total,
              },
            ],
          },
  };
}

async function updateShopifyMetafields(
  orderId: string,
  declarationNumber: string,
  declarationRef: string
) {
  const res = await fetch('shopify:admin/api/2024-07/graphql.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        mutation SetOrderMetafield($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            userErrors { message }
          }
        }
      `,
      variables: {
        metafields: [
          {
            ownerId: orderId,
            namespace: 'nova_poshta',
            key: 'declaration_number',
            type: 'single_line_text_field',
            value: declarationNumber,
          },
          {
            ownerId: orderId,
            namespace: 'nova_poshta',
            key: 'declaration_ref',
            type: 'single_line_text_field',
            value: declarationRef,
          },
        ],
      },
    }),
  });

  const data = await res.json();
  if (data.data.metafieldsSet.userErrors?.length > 0) {
    throw new Error(data.data.metafieldsSet.userErrors[0].message);
  }
}
