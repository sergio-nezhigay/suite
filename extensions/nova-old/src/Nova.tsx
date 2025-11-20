import {
  reactExtension,
  useApi,
  AdminBlock,
  BlockStack,
  Text,
  InlineStack,
  ProgressIndicator,
} from '@shopify/ui-extensions-react/admin';

import { useState, useEffect } from 'react';

import {
  getOrderInfo,
  NovaPoshtaWarehouse,
  OrderInfo,
} from '../../shared/shopifyOperations';
import NovaPoshtaSelector from './NovaPoshtaSelector';
import NovaPoshtaActions from './NovaPoshtaActions';
import ProbabilityIndicator from './ProbabilityIndicator';

const TARGET = 'admin.order-details.block.render';

export default reactExtension(TARGET, () => <WarehouseExtension />);

function WarehouseExtension() {
  const { data } = useApi(TARGET);
  const orderId = data.selected[0]?.id;
  const [orderInfo, setOrderInfo] = useState<OrderInfo>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orderId) return;

    const fetchOrderInfo = async () => {
      setLoading(true);
      try {
        const orderInfo = await getOrderInfo(orderId);
        console.log('🚀 ~ orderInfo :', orderInfo);
        if (orderInfo) {
          setOrderInfo(orderInfo);
        }
      } catch (error) {
        console.error('Error fetching order info:', error);
        setOrderInfo(null);
      } finally {
        setLoading(false);
      }
    };

    fetchOrderInfo();
  }, [orderId]);

  const probability = Math.round(
    (orderInfo?.novaposhtaRecepientWarehouse?.matchProbability || 0) * 100
  );

  const setNovaPoshtaWarehouse = (value: NovaPoshtaWarehouse) => {
    if (!orderInfo) return;
    setOrderInfo({ ...orderInfo, novaposhtaRecepientWarehouse: value });
  };

  return (
    <AdminBlock title='NovaPoshta'>
      <BlockStack gap>
        {loading ? (
          <ProgressIndicator size='small-300' />
        ) : (
          <>
            <BlockStack gap>
              <InlineStack gap inlineAlignment='space-between'>
                <Text fontWeight='bold'>Оригінал-</Text>
                <Text>
                  {orderInfo?.orderDetails?.city},{' '}
                  {orderInfo?.orderDetails?.address}
                </Text>
              </InlineStack>

              <ProbabilityIndicator probability={probability} />
              <NovaPoshtaSelector
                novaPoshtaWarehouse={orderInfo?.novaposhtaRecepientWarehouse}
                setNovaPoshtaWarehouse={setNovaPoshtaWarehouse}
                orderInfo={orderInfo}
              />
              <NovaPoshtaActions
                orderInfo={orderInfo}
                setOrderInfo={setOrderInfo}
              />
            </BlockStack>
          </>
        )}
      </BlockStack>
    </AdminBlock>
  );
}
