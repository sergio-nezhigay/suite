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
  OrderDetails,
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

  const [orderDetails, setOrderDetails] = useState<OrderDetails>(null);
  const [novaPoshtaWarehouse, setNovaPoshtaWarehouse] =
    useState<NovaPoshtaWarehouse>(null);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orderId) return;

    const fetchOrderInfo = async () => {
      setLoading(true);
      try {
        const orderInfo = await getOrderInfo(orderId);
        console.log('🚀 ~ orderInfo:', orderInfo);
        setOrderDetails(orderInfo.orderDetails);
        setNovaPoshtaWarehouse(orderInfo.novaPoshtaWarehouse);
      } catch (error) {
        console.error('Error fetching order info:', error);
        setOrderDetails(null);
        setNovaPoshtaWarehouse(null);
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
                Пункт: {orderDetails?.city || 'N/A'}. Адреса:{' '}
                {orderDetails?.address || 'N/A'}
              </Text>
            </InlineStack>

            {novaPoshtaWarehouse && (
              <BlockStack gap>
                <ProbabilityIndicator
                  probability={Math.round(
                    novaPoshtaWarehouse?.matchProbability * 100
                  )}
                />
                <NovaPoshtaSelector bestWarehouse={novaPoshtaWarehouse} />
                <NovaPoshtaActions
                  orderDetails={orderDetails}
                  recepientWarehouse={novaPoshtaWarehouse}
                />
              </BlockStack>
            )}
          </>
        )}
      </BlockStack>
    </AdminBlock>
  );
}
