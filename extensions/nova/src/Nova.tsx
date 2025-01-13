import {
  reactExtension,
  useApi,
  AdminBlock,
  BlockStack,
  Text,
  Button,
  InlineStack,
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
    '#'.repeat(filledLength) + '-'.repeat(totalLength - filledLength);

  return (
    //<InlineStack inlineSize='100%' blockSize={12}>
    <Text>{filler}</Text>
    //</InlineStack>
  );
};

function WarehouseExtension() {
  const { data } = useApi(TARGET);
  const orderId = data.selected[0]?.id;
  const [orderInfo, setOrderInfo] = useState<OrderInfo>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orderId) return;

    const fetchOrderInfo = async () => {
      try {
        const orderInfo = await getOrderInfo(orderId);
        console.log('🚀 ~ orderInfo:', orderInfo);
        setOrderInfo(orderInfo);
      } catch (error) {
        console.error('Error fetching order info:', error);
        setOrderInfo(null);
      }
    };

    fetchOrderInfo();
  }, [orderId]);

  //  const handleGetSimilarWarehouses = async () => {
  //    if (!orderInfo) {
  //      console.error('No order info to fetch similar warehouses');
  //      return;
  //    }

  //    setLoading(true);
  //    setResponseData(null);

  //    try {
  //      const response = await fetch('https://novaposhta.gadget.app/find', {
  //        method: 'POST',
  //        headers: {
  //          'Content-Type': 'application/json',
  //        },
  //        body: JSON.stringify(orderInfo),
  //      });

  //      if (!response.ok) {
  //        throw new Error(`HTTP error! status: ${response.status}`);
  //      }

  //      const result: BestWarehouse = await response.json();
  //      setResponseData(result);
  //    } catch (error) {
  //      console.error('Error fetching similar warehouses:', error);
  //      setResponseData(null);
  //    } finally {
  //      setLoading(false);
  //    }
  //  };

  return (
    <AdminBlock title='NovaPoshta'>
      <BlockStack gap>
        <InlineStack gap inlineAlignment='space-between'>
          <Text fontWeight='bold'>Order Information</Text>
          {/*<Text>{JSON.stringify(orderInfo)}</Text>*/}
          <Text>
            Пункт: {orderInfo?.city || 'Loading...'}. Адреса:{' '}
            {orderInfo?.address || ''}
          </Text>
        </InlineStack>

        {!loading && orderInfo?.nova_poshta_warehouse && (
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
            {/*{orderInfo && responseData.bestWarehouse && (
              <NovaPoshtaActions
                warehouse={responseData.bestWarehouse}
                orderInfo={orderInfo}
              />
            )}*/}
          </BlockStack>
        )}
      </BlockStack>
    </AdminBlock>
  );
}
