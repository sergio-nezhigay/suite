import {
  reactExtension,
  useApi,
  AdminBlock,
  BlockStack,
  Text,
  Button,
  InlineStack,
  Banner,
  TextField,
  Box,
  Divider,
} from '@shopify/ui-extensions-react/admin';
import { useEffect, useState } from 'react';
import {
  makeGraphQLQuery,
  ORDER_EDIT_BEGIN_MUTATION,
  ORDER_EDIT_SET_QUANTITY_MUTATION,
  ORDER_EDIT_COMMIT_MUTATION,
  ORDER_EDIT_ADD_CUSTOM_ITEM_MUTATION,
} from './utils';

// The target used here must match the target used in the extension's toml file (./shopify.extension.toml)
const TARGET = 'admin.order-details.block.render';

export default reactExtension(TARGET, () => <App />);

function App() {
  const { data } = useApi(TARGET);
  const orderId = data.selected[0]?.id;
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [calculatedOrderId, setCalculatedOrderId] = useState<string | null>(null);
  const [currencyCode, setCurrencyCode] = useState<string>('USD'); // Default to USD, update from order
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New Item State
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('1');
  const [addingItem, setAddingItem] = useState(false);

  useEffect(() => {
    console.log('[Debug] App mounted. Order ID:', orderId);
    if (orderId) {
      fetchItems();
    } else {
      console.warn('[Debug] No order ID found in context');
    }
  }, [orderId]);

  async function fetchItems() {
    setLoading(true);
    setError(null);
    try {
      console.log('[Debug] Fetching items for order:', orderId);
      const response = await makeGraphQLQuery(ORDER_EDIT_BEGIN_MUTATION, { id: orderId });
      console.log('[Debug] Order edit begin response:', JSON.stringify(response));

      if (response.data?.orderEditBegin?.userErrors?.length > 0) {
        const errorMsg = response.data.orderEditBegin.userErrors[0].message;
        console.error('[Debug] Order edit begin error:', errorMsg);
        setError(errorMsg);
        return;
      }

      const order = response.data?.orderEditBegin?.calculatedOrder;
      if (order) {
        console.log('[Debug] Calculated Order ID:', order.id);
        setCalculatedOrderId(order.id);
        if (order.totalPriceSet?.shopMoney?.currencyCode) {
          setCurrencyCode(order.totalPriceSet.shopMoney.currencyCode);
        }
        const items = order.lineItems?.edges?.map((edge: any) => edge.node) || [];
        setLineItems(items);
      } else {
        console.error('[Debug] No calculated order returned');
      }
    } catch (err: any) {
      console.error('Failed to fetch order items:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveItem(lineItemId: string) {
    // ... existing code ...
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

  async function handleAddCustomItem() {
    console.log('[Debug] handleAddCustomItem called');
    console.log('[Debug] State:', { calculatedOrderId, newItemTitle, newItemPrice, newItemQuantity });

    if (!calculatedOrderId) {
      setError('Internal Error: No calculated order ID. Please refresh.');
      return;
    }
    if (!newItemTitle || !newItemPrice || !newItemQuantity) {
      setError('Please enter title, price, and quantity');
      return;
    }

    const quantity = parseInt(newItemQuantity, 10);
    if (isNaN(quantity) || quantity < 1) {
      setError('Quantity must be a positive number');
      return;
    }

    setAddingItem(true);
    setError(null);

    try {
      console.log(`[Debug] Adding custom item with currency: ${currencyCode}...`);
      const addRes = await makeGraphQLQuery(ORDER_EDIT_ADD_CUSTOM_ITEM_MUTATION, {
        id: calculatedOrderId,
        title: newItemTitle,
        price: { amount: newItemPrice, currencyCode: currencyCode },
        quantity: quantity,
      });
      console.log('[Debug] Add custom item response:', JSON.stringify(addRes));

      if (addRes.data?.orderEditAddCustomItem?.userErrors?.length > 0) {
        throw new Error(addRes.data.orderEditAddCustomItem.userErrors[0].message);
      }

      // Commit changes to save the new item
      console.log('[Debug] Committing changes after add...');
      const commitRes = await makeGraphQLQuery(ORDER_EDIT_COMMIT_MUTATION, {
        id: calculatedOrderId,
      });

      if (commitRes.data?.orderEditCommit?.userErrors?.length > 0) {
        throw new Error(commitRes.data.orderEditCommit.userErrors[0].message);
      }

      // Clear inputs and refresh
      setNewItemTitle('');
      setNewItemPrice('');
      setNewItemQuantity('1');
      await fetchItems();

    } catch (err: any) {
      console.error('[Debug] Failed to add custom item:', err);
      setError(err.message);
    } finally {
      setAddingItem(false);
    }
  }

  return (
    <AdminBlock title='Order Editor'>
      <BlockStack gap="base">
        {error && <Banner tone="critical">{error}</Banner>}

        {/* Line Items List */}
        {loading && <Text>Loading items...</Text>}

        {!loading && lineItems.filter(item => item.quantity > 0).map((item) => (
          <InlineStack key={item.id} inlineAlignment="space-between" blockAlignment="center">
            <Text>
              {item.title} - Qty: {item.quantity} - {item.discountedUnitPriceSet?.shopMoney?.amount}
            </Text>
            <Button onPress={() => handleRemoveItem(item.id)} tone="critical" variant="tertiary">
              Remove
            </Button>
          </InlineStack>
        ))}

        {!loading && lineItems.filter(item => item.quantity > 0).length === 0 && (
          <Text>No items in this order.</Text>
        )}

        <Divider />

        {/* Add Custom Item Section */}
        <Box padding="base">
          <BlockStack gap>
            <Text fontWeight="bold">Add Custom Item</Text>
            <InlineStack gap="base">
              <TextField
                label="Title"
                value={newItemTitle}
                onChange={setNewItemTitle}

              />
              <TextField
                label="Price"
                value={newItemPrice}
                onChange={setNewItemPrice}

              />
              <TextField
                label="Quantity"
                value={newItemQuantity}
                onChange={setNewItemQuantity}

              />
            </InlineStack>
            <Button
              onPress={handleAddCustomItem}
              disabled={addingItem || !newItemTitle || !newItemPrice || !newItemQuantity}
            >
              {addingItem ? 'Adding...' : 'Add Item'}
            </Button>
          </BlockStack>
        </Box>
      </BlockStack>
    </AdminBlock>
  );
}
