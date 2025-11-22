import {
  reactExtension,
  useApi,
  AdminBlock,
  BlockStack,
  Text,
  Button,
  InlineStack,
  Banner,
} from '@shopify/ui-extensions-react/admin';
import { useEffect, useState } from 'react';
import {
  makeGraphQLQuery,
  ORDER_EDIT_BEGIN_MUTATION,
  ORDER_EDIT_SET_QUANTITY_MUTATION,
  ORDER_EDIT_COMMIT_MUTATION,
} from './utils';

// The target used here must match the target used in the extension's toml file (./shopify.extension.toml)
const TARGET = 'admin.order-details.block.render';

export default reactExtension(TARGET, () => <App />);

function App() {
  const { data } = useApi(TARGET);
  const orderId = data.selected[0]?.id;
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [calculatedOrderId, setCalculatedOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (orderId) {
      fetchItems();
    }
  }, [orderId]);

  async function fetchItems() {
    setLoading(true);
    setError(null);
    try {
      const response = await makeGraphQLQuery(ORDER_EDIT_BEGIN_MUTATION, { id: orderId });

      if (response.data?.orderEditBegin?.userErrors?.length > 0) {
        setError(response.data.orderEditBegin.userErrors[0].message);
        return;
      }

      const order = response.data?.orderEditBegin?.calculatedOrder;
      if (order) {
        setCalculatedOrderId(order.id);
        const items = order.lineItems?.edges?.map((edge: any) => edge.node) || [];
        setLineItems(items);
      }
    } catch (err: any) {
      console.error('Failed to fetch order items:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveItem(lineItemId: string) {
    if (!calculatedOrderId) return;
    setLoading(true);
    setError(null);

    console.log(`[Debug] Starting removal of item: ${lineItemId}`);

    try {
      // 1. Set Quantity to 0
      console.log('[Debug] Setting quantity to 0...');
      const setQuantityRes = await makeGraphQLQuery(ORDER_EDIT_SET_QUANTITY_MUTATION, {
        id: calculatedOrderId,
        lineItemId,
        quantity: 0,
        restock: true,
      });
      console.log('[Debug] Set quantity response:', JSON.stringify(setQuantityRes));

      if (setQuantityRes.data?.orderEditSetQuantity?.userErrors?.length > 0) {
        throw new Error(setQuantityRes.data.orderEditSetQuantity.userErrors[0].message);
      }

      // 2. Commit
      console.log('[Debug] Committing changes...');
      const commitRes = await makeGraphQLQuery(ORDER_EDIT_COMMIT_MUTATION, {
        id: calculatedOrderId,
      });
      console.log('[Debug] Commit response:', JSON.stringify(commitRes));

      if (commitRes.data?.orderEditCommit?.userErrors?.length > 0) {
        throw new Error(commitRes.data.orderEditCommit.userErrors[0].message);
      }

      // 3. Refresh
      console.log('[Debug] Refreshing items...');
      await fetchItems();
      console.log('[Debug] Items refreshed');

    } catch (err: any) {
      console.error('[Debug] Failed to remove item:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminBlock title='Order Editor'>
      <BlockStack>
        {error && <Banner tone="critical">{error}</Banner>}
        {loading && <Text>Loading...</Text>}

        {!loading && lineItems.map((item) => (
          <InlineStack key={item.id} inlineAlignment="space-between" blockAlignment="center">
            <BlockStack gap="none">
              <Text fontWeight="bold">{item.title}</Text>
              <Text>Qty: {item.quantity}</Text>
              <Text>
                {item.discountedUnitPriceSet?.shopMoney?.amount} {item.discountedUnitPriceSet?.shopMoney?.currencyCode}
              </Text>
            </BlockStack>
            <Button onPress={() => handleRemoveItem(item.id)} tone="critical">
              Remove
            </Button>
          </InlineStack>
        ))}
      </BlockStack>
    </AdminBlock>
  );
}
