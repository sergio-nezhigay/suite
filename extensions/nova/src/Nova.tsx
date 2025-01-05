import {
  reactExtension,
  useApi,
  AdminBlock,
  BlockStack,
  Text,
  Button,
} from '@shopify/ui-extensions-react/admin';
import { useState, useEffect } from 'react';

import { getOrderInfo } from '../../shared/shopifyOperations';

const TARGET = 'admin.order-details.block.render';

export default reactExtension(TARGET, () => <WarehouseExtension />);

function WarehouseExtension() {
  const { data } = useApi(TARGET);
  const orderId = data.selected[0]?.id; // Ensure `selected` exists and has an ID
  const [orderInfo, setOrderInfo] = useState<{
    address: string;
    zip: string;
  } | null>(null);
  const [responseData, setResponseData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orderId) return;

    const fetchOrderInfo = async () => {
      try {
        const { address, zip } = await getOrderInfo(orderId);
        setOrderInfo({ address, zip });
      } catch (error) {
        console.error('Error fetching order info:', error);
        setOrderInfo({ address: 'Unknown', zip: 'Unknown' }); // Fallback in case of error
      }
    };

    fetchOrderInfo();
  }, [orderId]);

  const handleGetSimilarWarehouses = async () => {
    if (!orderInfo) {
      alert('Order information not available!');
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
      setResponseData(JSON.stringify(result, null, 2)); // Pretty-print JSON for display
    } catch (error) {
      console.error('Error fetching similar warehouses:', error);
      setResponseData('Error fetching similar warehouses');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminBlock title='NovaPoshta'>
      <BlockStack>
        <Text fontWeight='bold'>Order Information</Text>
        <Text>Address: {orderInfo?.address || 'Loading...'}</Text>
        <Text>ZIP Code: {orderInfo?.zip || ''}</Text>
        <Button
          onPress={handleGetSimilarWarehouses}
          disabled={loading || !orderInfo}
        >
          {loading ? 'Fetching...' : 'Get similar warehouses'}
        </Button>
        {responseData && <Text>{responseData}</Text>}
      </BlockStack>
    </AdminBlock>
  );
}
