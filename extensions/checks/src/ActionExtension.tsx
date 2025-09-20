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
  fulfillments: Array<{
    id: string;
    trackingInfo: Array<{
      number?: string;
    }>;
  }>;
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
              fulfillments(first: 5) {
                id
                trackingInfo(first: 10) {
                  number
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

        // Log for debugging
        console.log('GraphQL Response:', ordersData);

        if (ordersData.errors) {
          console.error('GraphQL Errors:', ordersData.errors);
        }

        setOrders(ordersData.data?.nodes || []);
      } catch (error) {
        console.error('Error fetching orders:', error);
        setOrders([]);
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

  // Product variants list
  const productVariants = [
    'Кабель USB консольний',
    'Перехідник HDMI-RCA',
    'Кабель SCART',
    'Перехідник SCART',
    'Перехідник USB-RS232',
    'Кабель USB-RS232 1.5m',
    'Кабель USB-RS232 3 метри',
    'Перехідник HDMI-DP',
    'Кабель USB Type C',
    'Перехідник HDMI-VGA',
    'Термопаста, 2 гр.',
  ];

  // Simple string similarity function using Levenshtein distance
  const calculateSimilarity = (str1: string, str2: string): number => {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    const matrix = Array(s2.length + 1)
      .fill(null)
      .map(() => Array(s1.length + 1).fill(null));

    for (let i = 0; i <= s1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= s2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= s2.length; j++) {
      for (let i = 1; i <= s1.length; i++) {
        const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    const maxLen = Math.max(s1.length, s2.length);
    return maxLen === 0 ? 1 : (maxLen - matrix[s2.length][s1.length]) / maxLen;
  };

  // Find most similar product variant
  const findBestVariant = (productTitle: string): string => {
    let bestMatch = productVariants[0];
    let bestScore = 0;

    for (const variant of productVariants) {
      const score = calculateSimilarity(productTitle, variant);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = variant;
      }
    }

    return bestMatch;
  };

  const getPaymentMethod = (metafields: Order['metafields']) => {
    const paymentMethodField = metafields?.nodes?.find(
      (field) => field.namespace === 'custom' && field.key === 'payment_method'
    );
    const fullPaymentMethod = paymentMethodField?.value || 'Not specified';
    return fullPaymentMethod.split(' ')[0];
  };

  const getTrackingNumber = (fulfillments: Order['fulfillments']) => {
    // Get the first tracking number from the first fulfillment
    const trackingNumber = fulfillments?.[0]?.trackingInfo?.[0]?.number;
    return trackingNumber || null;
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
                        <Box minInlineSize='35%'>
                          <Text>{order.customer?.displayName || 'Guest'}</Text>
                        </Box>
                        <Box minInlineSize='25%'>
                          <Badge>{getPaymentMethod(order.metafields)}</Badge>
                        </Box>
                        <Box minInlineSize='40%'>
                          {getTrackingNumber(order.fulfillments) && (
                            <Text>{getTrackingNumber(order.fulfillments)}</Text>
                          )}
                        </Box>
                      </InlineStack>
                    </Box>

                    {/* Line Items */}
                    {formatLineItemsWithPrices(order.lineItems).map(
                      (item, itemIndex) => (
                        <Box key={itemIndex}>
                          <InlineStack>
                            <Box minInlineSize='45%'>
                              <Text>{truncateProductName(item.title)}</Text>
                            </Box>
                            <Box minInlineSize='15%'>
                              <Text>{findBestVariant(item.title)}</Text>
                            </Box>
                            <Box minInlineSize='15%'>
                              <Badge>{item.quantity}</Badge>
                            </Box>
                            <Box minInlineSize='25%'>
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
