import {
  reactExtension,
  useApi,
  AdminBlock,
  BlockStack,
  Text,
  Button,
  InlineStack,
  ProgressIndicator,
} from '@shopify/ui-extensions-react/admin';

import { useState, useEffect } from 'react';

import { getOrderInfo } from '../../shared/shopifyOperations';

const TARGET = 'admin.order-details.block.render';

export default reactExtension(TARGET, () => <WarehouseExtension />);

type ProgressBarProps = {
  progress: number;
};

const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
  const totalLength = 20;
  const filledLength = Math.round((progress / 100) * totalLength);

  const filler =
    '#'.repeat(filledLength) + '-'.repeat(totalLength - filledLength);

  return (
    <InlineStack inlineSize='100%' blockSize={12}>
      <Text>{filler}</Text>
    </InlineStack>
  );
};

function WarehouseExtension() {
  const { data } = useApi(TARGET);
  const orderId = data.selected[0]?.id;
  const [orderInfo, setOrderInfo] = useState<{
    city: string | null;
    address: string | null;
    zip: string | null;
  } | null>(null);
  const [responseData, setResponseData] = useState<{
    bestWarehouse: {
      id: string;
      description: string;
      cityDescription: string;
    } | null;
    matchProbability: number;
  } | null>(null);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orderId) return;

    const fetchOrderInfo = async () => {
      try {
        const { city, address, zip } = await getOrderInfo(orderId);
        setOrderInfo({ city, address, zip });
      } catch (error) {
        console.error('Error fetching order info:', error);
        setOrderInfo({ city: 'Unknown', address: 'Unknown', zip: 'Unknown' });
      }
    };

    fetchOrderInfo();
  }, [orderId]);

  const handleGetSimilarWarehouses = async () => {
    if (!orderInfo) {
      console.error('No order info to fetch similar warehouses');
      return;
    }

    setLoading(true);
    setResponseData(null);

    try {
      const response = await fetch('https://2--development.gadget.app/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderInfo),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setResponseData(result);
    } catch (error) {
      console.error('Error fetching similar warehouses:', error);
      setResponseData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminBlock title='NovaPoshta'>
      <BlockStack>
        <Text fontWeight='bold'>Order Information</Text>
        <Text>City: {orderInfo?.city || 'Loading...'}</Text>
        <Text>Address: {orderInfo?.address || 'Loading...'}</Text>
        {/*<Text>ZIP Code: {orderInfo?.zip || ''}</Text>*/}
        <Button
          onPress={handleGetSimilarWarehouses}
          disabled={loading || !orderInfo}
        >
          {loading ? 'Fetching...' : 'Get similar warehouses'}
        </Button>
        {loading && <ProgressIndicator size='base' />}
        {!loading && responseData?.bestWarehouse && (
          <BlockStack>
            <Text fontWeight='bold'>Best Warehouse</Text>
            {/*<Text>ID: {responseData.bestWarehouse.id}</Text>*/}
            <Text>{responseData.bestWarehouse.cityDescription}</Text>
            <Text>{responseData.bestWarehouse.description}</Text>

            <Text fontWeight='bold' fontVariant='numeric'>
              Probability: {Math.round(responseData.matchProbability * 100)}%
            </Text>
            <ProgressBar
              progress={Math.round(responseData.matchProbability * 100)}
            />
          </BlockStack>
        )}

        {responseData === null && !loading && (
          <Text>No similar warehouses found.</Text>
        )}
      </BlockStack>
    </AdminBlock>
  );
}
