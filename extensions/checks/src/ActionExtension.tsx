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
      discountedUnitPriceSet: {
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

interface ReceiptResult {
  orderId: string;
  orderName?: string;
  success?: boolean;
  receiptId?: string;
  fiscalCode?: string;
  ettnNumber?: string;
  error?: string;
}

function App() {
  const { close, data } = useApi(TARGET);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [receiptResults, setReceiptResults] = useState<ReceiptResult[]>([]);
  const [productVariantsCache, setProductVariantsCache] = useState<Record<string, string>>({});
  const [variantsLoading, setVariantsLoading] = useState(false);

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
                  discountedUnitPriceSet {
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

  // Fetch variants when orders change
  useEffect(() => {
    if (orders.length > 0) {
      setVariantsLoading(true);
      const allProductTitles = new Set<string>();
      orders.forEach(order => {
        order.lineItems.nodes.forEach(item => {
          allProductTitles.add(item.title);
        });
      });

      if (allProductTitles.size > 0) {
        fetchBestVariants(Array.from(allProductTitles)).then(variants => {
          setProductVariantsCache(variants);
          setVariantsLoading(false);
        });
      } else {
        setVariantsLoading(false);
      }
    }
  }, [orders]);

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

  // Helper functions for fetching variants from backend
  const fetchBestVariant = async (productTitle: string): Promise<string> => {
    try {
      const response = await fetch(`/findBestVariant?productTitle=${encodeURIComponent(productTitle)}`);
      if (!response.ok) {
        console.log('Failed to fetch variant for:', productTitle);
        return '';
      }
      const data = await response.json();
      return data.bestVariant;
    } catch (error) {
      console.log('Error fetching variant for:', productTitle, error);
      return '';
    }
  };

  // For batch processing multiple titles at once
  const fetchBestVariants = async (productTitles: string[]): Promise<Record<string, string>> => {
    const variants: Record<string, string> = {};

    // Process in parallel for better performance
    const promises = productTitles.map(async (title) => {
      const variant = await fetchBestVariant(title);
      variants[title] = variant;
    });

    await Promise.all(promises);
    return variants;
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

  const handleProcessChecks = async () => {
    setProcessing(true);
    setReceiptResults([]);

    try {
      console.log('Creating Checkbox receipts for orders:', selectedIds);

      // Prepare order data with tracking numbers and product variants
      const orderData = orders.map(order => ({
        orderId: order.id,
        trackingNumber: getTrackingNumber(order.fulfillments),
        customer: order.customer?.displayName,
        lineItems: order.lineItems.nodes.map(item => ({
          title: item.title,
          variant: productVariantsCache[item.title],
          quantity: item.quantity,
          // Use discounted price if available, fallback to original
          price: formatPrice(
            item.discountedUnitPriceSet.shopMoney.amount ||
            item.originalUnitPriceSet.shopMoney.amount
          )
        }))
      }));

      const response = await fetch('/createCheckboxReceipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: orderData }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setReceiptResults(data.results);

      console.log('Checkbox receipts results:', data.results);
    } catch (error) {
      console.error('Error creating receipts:', error);
      setReceiptResults([
        {
          orderId: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      ]);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <AdminAction
      title={`Checks for ${selectedIds.length} selected order${
        selectedIds.length === 1 ? '' : 's'
      }`}
      loading={loading}
      primaryAction={
        <Button
          onPress={handleProcessChecks}
          disabled={loading || orders.length === 0 || processing || variantsLoading}
        >
          {processing ? 'Processing...' : variantsLoading ? 'Loading variants...' : 'Process Checks'}
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
                      (item, itemIndex) => {
                        const originalPrice = formatPrice(item.originalUnitPriceSet.shopMoney.amount);
                        const discountedPrice = formatPrice(item.discountedUnitPriceSet.shopMoney.amount);
                        const hasDiscount = originalPrice !== discountedPrice;

                        return (
                          <Box key={itemIndex}>
                            <InlineStack>
                              <Box minInlineSize='45%'>
                                <Text>{truncateProductName(item.title)}</Text>
                              </Box>
                              <Box minInlineSize='15%'>
                                <Text>{productVariantsCache[item.title]}</Text>
                              </Box>
                              <Box minInlineSize='15%'>
                                <Badge>{item.quantity}</Badge>
                              </Box>
                              <Box minInlineSize='25%'>
                                {hasDiscount ? (
                                  <BlockStack>
                                    <Text>
                                      <s>{originalPrice}</s>
                                    </Text>
                                    <Badge tone="success">{discountedPrice}</Badge>
                                  </BlockStack>
                                ) : (
                                  <Text>{originalPrice}</Text>
                                )}
                              </Box>
                            </InlineStack>
                          </Box>
                        );
                      }
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

        {receiptResults.length > 0 && (
          <Section heading='Receipt Results'>
            <BlockStack>
              {receiptResults.map((result, index) => (
                <Box key={index}>
                  <InlineStack>
                    <Box minInlineSize='40%'>
                      <Text>{result.orderName || result.orderId}</Text>
                    </Box>
                    <Box minInlineSize='60%'>
                      {result.success ? (
                        <BlockStack>
                          <Badge tone='success'>✓ Receipt Created</Badge>
                          {result.fiscalCode && (
                            <Text>Fiscal: {result.fiscalCode}</Text>
                          )}
                          {result.ettnNumber && (
                            <Text>ETTN: {result.ettnNumber}</Text>
                          )}
                        </BlockStack>
                      ) : (
                        <Badge tone='critical'>✗ {result.error}</Badge>
                      )}
                    </Box>
                  </InlineStack>
                </Box>
              ))}
            </BlockStack>
          </Section>
        )}
      </BlockStack>
    </AdminAction>
  );
}
