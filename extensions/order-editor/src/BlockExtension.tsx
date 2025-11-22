import {
  reactExtension,
  useApi,
  AdminBlock,
  BlockStack,
  Text,
} from '@shopify/ui-extensions-react/admin';
import { useEffect } from 'react';
import { makeGraphQLQuery, ORDER_EDIT_BEGIN_MUTATION } from './utils';

// The target used here must match the target used in the extension's toml file (./shopify.extension.toml)
const TARGET = 'admin.order-details.block.render';

export default reactExtension(TARGET, () => <App />);

function App() {
  const { data } = useApi(TARGET);
  const orderId = data.selected[0]?.id;

  useEffect(() => {
    if (orderId) {
      console.log('Order ID:', orderId);

      makeGraphQLQuery(ORDER_EDIT_BEGIN_MUTATION, { id: orderId })
        .then((response) => {
          const lineItems = response.data?.orderEditBegin?.calculatedOrder?.lineItems;
          console.log('Order Items:', lineItems);
        })
        .catch((err) => {
          console.error('Failed to fetch order items:', err);
        });
    }
  }, [orderId]);

  return (
    <AdminBlock title='Order Editor'>
      <BlockStack>
        <Text>Order ID logged to console.</Text>
      </BlockStack>
    </AdminBlock>
  );
}
