import {
  reactExtension,
  useApi,
  AdminBlock,
  BlockStack,
  Text,
  TextField,
  Button,
  Banner,
  Divider,
  InlineStack,
} from '@shopify/ui-extensions-react/admin';
import { useState, useEffect } from 'react';
import {
  makeGraphQLQuery,
  GET_ORDER_QUERY,
  ORDER_EDIT_BEGIN_MUTATION,
  ORDER_EDIT_ADD_CUSTOM_ITEM_MUTATION,
  ORDER_EDIT_COMMIT_MUTATION,
  ORDER_EDIT_SET_QUANTITY_MUTATION,
} from './utils';


// The target used here must match the target used in the extension's toml file (./shopify.extension.toml)
const TARGET = 'admin.order-details.block.render';

export default reactExtension(TARGET, () => <App />);

function App() {
  const { i18n, data } = useApi(TARGET);
  const orderId = data.selected[0]?.id;

  // Line Items State
  const [lineItems, setLineItems] = useState<any[]>([]);

  // Add Item State
  const [itemTitle, setItemTitle] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [isAddingItem, setIsAddingItem] = useState(false);

  // Global State
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    fetchOrderData(orderId);
  }, [orderId]);

  async function fetchOrderData(id: string) {
    setIsLoading(true);
    setError(null);
    try {
      const response = await makeGraphQLQuery(GET_ORDER_QUERY, { id });
      const fetchedCurrency = response.data?.order?.currencyCode || 'USD';
      const fetchedItems =
        response.data?.order?.lineItems?.edges?.map((edge: any) => edge.node) ||
        [];

      setCurrencyCode(fetchedCurrency);
      setLineItems(fetchedItems);
    } catch (err) {
      setError('Failed to load order data');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddItem() {
    if (!itemTitle || !itemPrice) {
      setError('Title and Price are required');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    console.log('Starting handleAddItem for order:', orderId);

    try {
      // 1. Begin Order Edit
      console.log('Step 1: Begin Order Edit');
      const beginRes = await makeGraphQLQuery(ORDER_EDIT_BEGIN_MUTATION, { id: orderId });
      const beginErrors = beginRes.data?.orderEditBegin?.userErrors;
      if (beginErrors?.length) {
        throw new Error(beginErrors[0].message);
      }
      const calculatedOrderId =
        beginRes.data?.orderEditBegin?.calculatedOrder?.id;

      // 2. Add Custom Item
      console.log('Step 2: Add Custom Item', {
        title: itemTitle,
        price: itemPrice,
        currency: currencyCode,
      });
      const addRes = await makeGraphQLQuery(ORDER_EDIT_ADD_CUSTOM_ITEM_MUTATION, {
        id: calculatedOrderId,
        title: itemTitle,
        price: { amount: itemPrice, currencyCode: currencyCode },
        quantity: 1,
      });
      const addErrors = addRes.data?.orderEditAddCustomItem?.userErrors;
      if (addErrors?.length) {
        throw new Error(addErrors[0].message);
      }

      // 3. Commit Order Edit
      console.log('Step 3: Commit Order Edit');
      const commitRes = await makeGraphQLQuery(ORDER_EDIT_COMMIT_MUTATION, {
        id: calculatedOrderId,
      });
      const commitErrors = commitRes.data?.orderEditCommit?.userErrors;
      if (commitErrors?.length) {
        throw new Error(commitErrors[0].message);
      }

      setSuccess('Item added successfully');
      setItemTitle('');
      setItemPrice('');
      setIsAddingItem(false);

      // Refresh order data to show new item
      await fetchOrderData(orderId);

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error in handleAddItem:', err);
      setError(err.message || 'Failed to add item');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemoveItem(lineItemId: string) {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    console.log('Starting handleRemoveItem for order:', orderId);

    try {
      // 1. Begin Order Edit
      console.log('Step 1: Begin Order Edit');
      const beginRes = await makeGraphQLQuery(ORDER_EDIT_BEGIN_MUTATION, { id: orderId });
      console.log('Step 1 Response:', JSON.stringify(beginRes, null, 2));

      const beginErrors = beginRes.data?.orderEditBegin?.userErrors;
      if (beginErrors?.length) {
        throw new Error(beginErrors[0].message);
      }
      const calculatedOrderId = beginRes.data?.orderEditBegin?.calculatedOrder?.id;
      console.log('Calculated Order ID:', calculatedOrderId);

      // 2. Set Quantity to 0 (Remove Item)
      console.log('Step 2: Set Quantity to 0 (Remove Item)', { lineItemId });
      const mutationVariables = {
        id: calculatedOrderId,
        lineItemId: lineItemId,
        quantity: 0,
        restock: true,
      };
      console.log('Step 2 Request Variables:', JSON.stringify(mutationVariables, null, 2));
      const setQuantityRes = await makeGraphQLQuery(ORDER_EDIT_SET_QUANTITY_MUTATION, mutationVariables);
      console.log('Step 2 Response:', JSON.stringify(setQuantityRes, null, 2));

      if (setQuantityRes.errors?.length) {
        throw new Error(setQuantityRes.errors[0].message);
      }

      // 3. Commit Order Edit
      console.log('Step 3: Commit Order Edit');
      const commitRes = await makeGraphQLQuery(ORDER_EDIT_COMMIT_MUTATION, {
        id: calculatedOrderId,
      });
      const commitErrors = commitRes.data?.orderEditCommit?.userErrors;
      if (commitErrors?.length) {
        throw new Error(commitErrors[0].message);
      }

      setSuccess('Item removed successfully');

      // Refresh order data
      await fetchOrderData(orderId);

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error in handleRemoveItem:', err);
      setError(err.message || 'Failed to remove item');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AdminBlock title='Order Editor'>
      <BlockStack>
        {error && <Banner tone='critical'>{error}</Banner>}
        {success && <Banner tone='success'>{success}</Banner>}

        <Text fontWeight='bold'>Line Items ({lineItems.length})</Text>
        <BlockStack>
          {lineItems.map((item) => (
            <InlineStack key={item.id} inlineAlignment='space-between'>
              <Text>
                {item.title} (x{item.quantity})
              </Text>
              <Text>
                {item.originalUnitPriceSet?.shopMoney?.amount}{' '}
                {item.originalUnitPriceSet?.shopMoney?.currencyCode}
              </Text>
              <Button
                tone="critical"
                onPress={() => handleRemoveItem(item.id)}
                disabled={isSaving}
              >
                Remove
              </Button>
            </InlineStack>
          ))}
        </BlockStack>

        <Divider />

        <BlockStack>
          <Text fontWeight='bold'>Add Custom Item</Text>
          {isAddingItem ? (
            <>
              <TextField
                label='Title'
                value={itemTitle}
                onChange={setItemTitle}
                disabled={isSaving}
              />
              <TextField
                label={`Price (${currencyCode})`}
                value={itemPrice}
                onChange={setItemPrice}
                disabled={isSaving}
              />
              <BlockStack inlineAlignment='start'>
                <Button onPress={handleAddItem} disabled={isSaving}>
                  {isSaving ? 'Adding...' : 'Add Item'}
                </Button>
                <Button
                  onPress={() => setIsAddingItem(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
              </BlockStack>
            </>
          ) : (
            <Button
              onPress={() => setIsAddingItem(true)}
              disabled={isLoading || isSaving}
            >
              Add New Item
            </Button>
          )}
        </BlockStack>
      </BlockStack>
    </AdminBlock>
  );
}
