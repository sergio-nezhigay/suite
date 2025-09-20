import { useEffect, useState } from 'react';
import {
  reactExtension,
  useApi,
  AdminAction,
  BlockStack,
  InlineStack,
  Button,
  Text,
  Box,
  Section,
  Divider,
  Badge,
  Heading,
} from '@shopify/ui-extensions-react/admin';

// The target used here must match the target used in the extension's toml file (./shopify.extension.toml)
const TARGET = 'admin.order-index.selection-action.render';

export default reactExtension(TARGET, () => <App />);

interface Order {
  id: string;
  name: string;
  customer?: {
    displayName: string;
  };
  lineItems: {
    nodes: Array<{
      id: string;
      title: string;
      quantity: number;
      variant?: {
        title: string;
        sku?: string;
      };
      originalUnitPriceSet: {
        shopMoney: {
          amount: string;
          currencyCode: string;
        };
      };
    }>;
  };
  metafields: {
    nodes: Array<{
      id: string;
      namespace: string;
      key: string;
      value: string;
    }>;
  };
}

function App() {
  const { close, data } = useApi(TARGET);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const selectedIds = data?.selected?.map(({ id }) => id) || [];
  useEffect(() => {
    (async function getOrdersInfo() {
      if (selectedIds.length === 0) {
        setLoading(false);
        return;
      }

      const getOrdersQuery = {
        query: `query GetOrders($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Order {
              id
              name
              customer {
                displayName
              }
              lineItems(first: 10) {
                nodes {
                  id
                  title
                  quantity
                  variant {
                    title
                    sku
                  }
                  originalUnitPriceSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                }
              }
              metafields(first: 10) {
                nodes {
                  id
                  namespace
                  key
                  value
                }
              }
            }
          }
        }`,
        variables: { ids: selectedIds },
      };

      try {
        const res = await fetch('shopify:admin/api/graphql.json', {
          method: 'POST',
          body: JSON.stringify(getOrdersQuery),
        });

        if (!res.ok) {
          setLoading(false);
          return;
        }

        const ordersData = await res.json();
        setOrders(ordersData.data?.nodes || []);
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedIds.join(',')]);

  const formatPrice = (amount: string) => {
    return Math.round(parseFloat(amount)).toString();
  };

  const formatLineItemsWithPrices = (lineItems: Order['lineItems']) => {
    if (!lineItems?.nodes?.length) return [];
    return lineItems.nodes.slice(0, 5);
  };

  const truncateProductName = (name: string, maxLength: number = 40) => {
    return name.length > maxLength
      ? name.substring(0, maxLength) + '...'
      : name;
  };

  const getPaymentMethod = (metafields: Order['metafields']) => {
    const paymentMethodField = metafields?.nodes?.find(
      (field) => field.namespace === 'custom' && field.key === 'payment_method'
    );
    const fullPaymentMethod = paymentMethodField?.value || 'Not specified';
    return fullPaymentMethod.split(' ')[0];
  };

  return (
    <AdminAction
      title={`Checks for ${selectedIds.length} selected order${
        selectedIds.length === 1 ? '' : 's'
      }`}
      loading={loading}
      primaryAction={
        <Button onPress={close} disabled={loading || orders.length === 0}>
          Process Checks
        </Button>
      }
      secondaryAction={<Button onPress={close}>Close</Button>}
    >
      <BlockStack>
        {loading ? (
          <Text>Loading order details...</Text>
        ) : orders.length === 0 ? (
          <Text>No orders found</Text>
        ) : (
          <BlockStack>
            {orders.map((order, index) => (
              <BlockStack key={order.id}>
                <Section heading={order.name}>
                  <BlockStack>
                    {/* Order Summary */}
                    <Box>
                      <InlineStack>
                        <Box minInlineSize='50%'>
                          <Text>{order.customer?.displayName || 'Guest'}</Text>
                        </Box>
                        <Box minInlineSize='50%'>
                          <Badge>{getPaymentMethod(order.metafields)}</Badge>
                        </Box>
                      </InlineStack>
                    </Box>

                    {/* Line Items */}
                    {formatLineItemsWithPrices(order.lineItems).map(
                      (item, itemIndex) => (
                        <Box key={itemIndex}>
                          <InlineStack>
                            <Box minInlineSize='65%'>
                              <Text>{truncateProductName(item.title)}</Text>
                            </Box>
                            <Box minInlineSize='15%'>
                              <Badge>{item.quantity}</Badge>
                            </Box>
                            <Box minInlineSize='20%'>
                              <Text>
                                {formatPrice(
                                  item.originalUnitPriceSet.shopMoney.amount
                                )}
                              </Text>
                            </Box>
                          </InlineStack>
                        </Box>
                      )
                    )}
                    {order.lineItems.nodes.length > 5 && (
                      <Box>
                        <Text>
                          ...and {order.lineItems.nodes.length - 5} more items
                        </Text>
                      </Box>
                    )}
                  </BlockStack>
                </Section>
                {index < orders.length - 1 && <Divider />}
              </BlockStack>
            ))}
          </BlockStack>
        )}
      </BlockStack>
    </AdminAction>
  );
}
