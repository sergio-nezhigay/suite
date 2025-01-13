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

import { getOrderInfo, OrderInfo } from '../../shared/shopifyOperations';
//import NovaPoshtaActions from './NovaPoshtaActions';
import NovaPoshtaSelector from './NovaPoshtaSelector';
import NovaPoshtaActions from './NovaPoshtaActions';

const TARGET = 'admin.order-details.block.render';

export default reactExtension(TARGET, () => <WarehouseExtension />);

type ProbabilityBarProps = {
  probability: number;
};

const ProbabilityBar: React.FC<ProbabilityBarProps> = ({ probability }) => {
  const totalLength = 20;
  const filledLength = Math.round((probability / 100) * totalLength);

  const filler =
    '-'.repeat(filledLength) + '?'.repeat(totalLength - filledLength);

  return <Text>{filler}</Text>;
};

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
        console.log('🚀 ~ orderInfo:', orderInfo);
        setOrderInfo(orderInfo);
      } catch (error) {
        console.error('Error fetching order info:', error);
        setOrderInfo(null);
      } finally {
        setLoading(false);
      }
    };

    fetchOrderInfo();
  }, [orderId]);

  return (
    <AdminBlock title='NovaPoshta'>
      <BlockStack gap>
        {loading ? (
          <ProgressIndicator size='small-300' />
        ) : (
          <>
            <InlineStack gap inlineAlignment='space-between'>
              <Text fontWeight='bold'>Order Information</Text>
              <Text>
                Пункт: {orderInfo?.city || 'N/A'}. Адреса:{' '}
                {orderInfo?.address || 'N/A'}
              </Text>
            </InlineStack>

            {orderInfo && orderInfo.nova_poshta_warehouse && (
              <BlockStack gap>
                <InlineStack gap inlineAlignment='space-between'>
                  <Text fontWeight='bold' fontVariant='numeric'>
                    Probability:{' '}
                    {Math.round(
                      orderInfo.nova_poshta_warehouse?.matchProbability * 100
                    )}
                    %
                  </Text>
                  <ProbabilityBar
                    probability={Math.round(
                      orderInfo.nova_poshta_warehouse?.matchProbability * 100
                    )}
                  />
                </InlineStack>
                <NovaPoshtaSelector
                  bestWarehouse={orderInfo.nova_poshta_warehouse}
                />
                <NovaPoshtaActions orderInfo={orderInfo} />
              </BlockStack>
            )}
          </>
        )}
      </BlockStack>
    </AdminBlock>
  );
}
