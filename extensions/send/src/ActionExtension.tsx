import { useEffect, useState } from 'react';
import {
  reactExtension,
  useApi,
  AdminAction,
  BlockStack,
  Button,
  Text,
} from '@shopify/ui-extensions-react/admin';

const TARGET = 'admin.order-index.selection-action.render';

export default reactExtension(TARGET, () => <App />);

function App() {
  const [loading, setLoading] = useState<boolean>(true);
  const [ordersContent, setOrdersContent] = useState<any[]>([
    { id: '1001', name: 'Order 1001', total: '$50.00' },
    { id: '1002', name: 'Order 1002', total: '$75.00' },
    { id: '1003', name: 'Order 1003', total: '$20.00' },
  ]);
  const { close, data } = useApi(TARGET);
  const selectedOrders = data?.selected || [];
  const selectedIds = selectedOrders.map(({ id }) => id);

  useEffect(() => {
    async function fetchOrdersContent() {
      try {
        const response = await fetch('/some-route');
        const content = await response.json();
        setOrdersContent(content);
      } catch (error) {
        console.error('Failed to fetch orders content:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchOrdersContent();
  }, [selectedIds]);

  return (
    <AdminAction
      primaryAction={
        <Button
          onPress={() => {
            close();
          }}
          disabled={loading}
        >
          Close
        </Button>
      }
    >
      <BlockStack>
        <Text>Selected Orders Content:</Text>
        {loading ? (
          <Text>Loading...</Text>
        ) : ordersContent.length > 0 ? (
          <BlockStack>
            {ordersContent.map((order, index) => (
              <Text
                key={index}
              >{`Order ID: ${order.id}, Name: ${order.name}, Total: ${order.total}`}</Text>
            ))}
          </BlockStack>
        ) : (
          <Text>No orders content available</Text>
        )}
      </BlockStack>
    </AdminAction>
  );
}
