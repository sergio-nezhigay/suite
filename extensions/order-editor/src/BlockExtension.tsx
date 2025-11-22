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
      const query = `query Order($id: ID!) {
        order(id: $id) {
          currencyCode
          lineItems(first: 50) {
            edges {
              node {
                id
                title
                quantity
                originalUnitPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
              }
            }
          }
        }
      }`;
      const response = await makeGraphQLQuery(query, { id });
      const fetchedCurrency = response.data?.order?.currencyCode || 'USD';
      const fetchedItems = response.data?.order?.lineItems?.edges?.map((edge: any) => edge.node) || [];

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
      const beginMutation = `mutation orderEditBegin($id: ID!) {
        orderEditBegin(id: $id) {
          calculatedOrder {
            id
          }
          userErrors {
            field
            message
          }
        }
      }`;
      const beginRes = await makeGraphQLQuery(beginMutation, { id: orderId });
      if (beginRes.data?.orderEditBegin?.userErrors?.length) {
        throw new Error(beginRes.data.orderEditBegin.userErrors[0].message);
      }
      const calculatedOrderId = beginRes.data?.orderEditBegin?.calculatedOrder?.id;

      // 2. Add Custom Item
      console.log('Step 2: Add Custom Item', { title: itemTitle, price: itemPrice, currency: currencyCode });
      const addMutation = `mutation orderEditAddCustomItem($id: ID!, $title: String!, $price: MoneyInput!, $quantity: Int!) {
        orderEditAddCustomItem(id: $id, title: $title, price: $price, quantity: $quantity) {
          calculatedOrder {
            id
            lineItems(first: 10) {
              edges {
                node {
                  id
                  title
                }
              }
            }
            addedLineItems(first: 5) {
              edges {
                node {
                  id
                  title
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }`;
      const addRes = await makeGraphQLQuery(addMutation, {
        id: calculatedOrderId,
        title: itemTitle,
        price: { amount: itemPrice, currencyCode: currencyCode },
        quantity: 1
      });
      if (addRes.data?.orderEditAddCustomItem?.userErrors?.length) {
        throw new Error(addRes.data.orderEditAddCustomItem.userErrors[0].message);
      }

      // 3. Commit Order Edit
      console.log('Step 3: Commit Order Edit');
      const commitMutation = `mutation orderEditCommit($id: ID!) {
        orderEditCommit(id: $id) {
          order {
            id
            lineItems(first: 10) {
              edges {
                node {
                  id
                  title
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }`;
      const commitRes = await makeGraphQLQuery(commitMutation, { id: calculatedOrderId });
      if (commitRes.data?.orderEditCommit?.userErrors?.length) {
        throw new Error(commitRes.data.orderEditCommit.userErrors[0].message);
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

  async function makeGraphQLQuery(query: string, variables: any) {
    const res = await fetch('shopify:admin/api/graphql.json', {
      method: 'POST',
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error('Network error');
    return await res.json();
  }

  return (
    <AdminBlock title="Order Editor">
      <BlockStack>
        {error && <Banner tone="critical">{error}</Banner>}
        {success && <Banner tone="success">{success}</Banner>}

        <Text fontWeight="bold">Line Items ({lineItems.length})</Text>
        <BlockStack spacing="tight">
          {lineItems.map((item) => (
            <InlineStack key={item.id} inlineAlignment="space-between">
              <Text>{item.title} (x{item.quantity})</Text>
              <Text>{item.originalUnitPriceSet?.shopMoney?.amount} {item.originalUnitPriceSet?.shopMoney?.currencyCode}</Text>
            </InlineStack>
          ))}
        </BlockStack>

        <Divider />

        <BlockStack>
          <Text fontWeight="bold">Add Custom Item</Text>
          {isAddingItem ? (
            <>
              <TextField
                label="Title"
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
              <BlockStack inlineAlignment="start">
                 <Button onPress={handleAddItem} disabled={isSaving}>
                  {isSaving ? 'Adding...' : 'Add Item'}
                </Button>
                <Button onPress={() => setIsAddingItem(false)} disabled={isSaving}>
                  Cancel
                </Button>
              </BlockStack>
            </>
          ) : (
            <Button onPress={() => setIsAddingItem(true)} disabled={isLoading || isSaving}>
              Add New Item
            </Button>
          )}
        </BlockStack>
      </BlockStack>
    </AdminBlock>
  );
}
