import { makeGraphQLQuery } from './makeGraphQLQuery';

export async function getOrdersTags(orderIds: string[]): Promise<string[]> {
  const orderTagPromises = orderIds.map((id) => {
    const query = `#graphql
      query Order($id: ID!) {
        order(id: $id) {
          tags
        }
      }`;
    return makeGraphQLQuery<{ order: { tags: string[] } }>(query, { id });
  });

  const tagQueryResults = await Promise.all(orderTagPromises);
  const tags: string[] = [];
  tagQueryResults.forEach(({ data }) => {
    if (data?.order?.tags) {
      tags.push(...data.order.tags);
    }
  });

  return tags;
}

export type NovaPoshtaWarehouse = {
  cityDescription?: string;
  cityRef?: string;
  warehouseDescription?: string;
  warehouseRef?: string;
  settlementAreaDescription?: string;
  matchProbability?: number;
} | null;

export type OrderDetails = {
  id: string;
  tags: string[];
  orderNumber: string;
  total: string;
  customerId: string;
  firstName: string;
  lastName: string;
  clientIp: string;
  email: string | null;
  shippingPhone: string | null;
  city: string | null;
  address: string | null;
  zip: string | null;
  paymentMethod: string | null;
  lineItems?: {
    title: string;
    unfulfilledQuantity: number;
    variant: {
      sku: string;
    } | null;
    discountedUnitPriceSet: {
      shopMoney: {
        amount: string;
      };
    };
  }[];
} | null;

export type OrderInfo =
  | {
      orderDetails: OrderDetails;
      novaposhtaRecepientWarehouse: NovaPoshtaWarehouse;
      novaposhtaDeclaration: {
        number: string | null;
        ref: string | null;
      };
    }
  | null
  | undefined;

export async function getOrderInfo(orderId: string): Promise<OrderInfo> {
  const query = `#graphql
    query Order($id: ID!) {
      order(id: $id) {
        name
        phone
        email
        clientIp
        currentSubtotalPriceSet {
            shopMoney {
                amount
            }
        }
        tags
        customer {
            id
        }
        shippingAddress {
          firstName
          lastName
          phone
          address1
          city
          zip
        }
        paymentMethod: metafield(namespace: \"custom\", key: \"payment_method\") {
            value
        }
        novaposhtaRecepientWarehouse: metafield(namespace: \"nova_poshta\", key: \"recepient_warehouse\") {
            value
        }
        novaposhtaDeclarationNumber: metafield(namespace: \"nova_poshta\", key: \"declaration_number\") {
            value
        }
        novaposhtaDeclarationRef: metafield(namespace: \"nova_poshta\", key: \"declaration_ref\") {
            value
        }
            lineItems(first: 10) {
              nodes {
                title
                unfulfilledQuantity
                variant {
                  sku
                }
                product {
                  id
                }
                discountedUnitPriceSet {
                  shopMoney {
                    amount
                  }
                }
              }
            }
      }
    }`;
  const { data } = await makeGraphQLQuery<{
    order: {
      tags: string[];
      name: string;
      clientIp: string;
      phone: string | null;
      email: string | null;
      currentSubtotalPriceSet: {
        shopMoney: { amount: string };
      };
      customer: { id: string };
      shippingAddress: {
        firstName: string;
        lastName: string;
        phone: string;
        address1: string;
        city: string;
        zip: string;
      };
      paymentMethod: { value: string };
      novaposhtaRecepientWarehouse: { value: string };
      novaposhtaDeclarationNumber: { value: string };
      novaposhtaDeclarationRef: { value: string };
      lineItems: {
        nodes: {
          title: string;
          unfulfilledQuantity: number;
          variant: {
            sku: string;
          } | null;
          product: {
            id: string;
          };
          discountedUnitPriceSet: {
            shopMoney: {
              amount: string;
            };
          };
        }[];
      };
    };
  }>(query, { id: orderId });

  if (data?.order) {
    const {
      tags,
      name,
      email,
      phone,
      currentSubtotalPriceSet,
      customer,
      clientIp,
      shippingAddress,
      paymentMethod,
      novaposhtaRecepientWarehouse,
      novaposhtaDeclarationNumber,
      novaposhtaDeclarationRef,
      lineItems,
    } = data?.order;

    for (const item of lineItems.nodes) {
      if (!item.variant && item.product?.id) {
        const variantDetails = await fetchVariantDetails(item.product.id);
        if (variantDetails) {
          item.variant = variantDetails;
        }
      }
    }

    const zip =
      shippingAddress?.zip !== '12345' ? `${shippingAddress?.zip}` : '';
    try {
      const orderDetails = {
        id: orderId,
        tags,
        orderNumber: name,
        total: currentSubtotalPriceSet.shopMoney.amount,
        customerId: customer?.id,
        firstName: shippingAddress?.firstName,
        lastName: shippingAddress?.lastName,
        shippingPhone: phone || shippingAddress?.phone || null,
        email: email || null,
        clientIp,
        city: shippingAddress?.city,
        address: shippingAddress?.address1,
        zip,
        paymentMethod: paymentMethod?.value,
        lineItems: lineItems?.nodes || [],
      };
      return {
        orderDetails,
        novaposhtaRecepientWarehouse: JSON.parse(
          novaposhtaRecepientWarehouse?.value || '{}'
        ),
        novaposhtaDeclaration: {
          number: novaposhtaDeclarationNumber?.value || null,
          ref: novaposhtaDeclarationRef?.value || null,
        },
      };
    } catch (error) {
      throw new Error(`Parsing error: ${error}`);
    }
  }
  throw new Error(`Order ${orderId} not found`);
}

export async function updateOrdersTags({
  value,
  orderIds,
}: {
  value: string;
  orderIds: string[];
}): Promise<string[]> {
  console.log(
    'Starting updateOrdersTags with value:',
    value,
    'and orderIds:',
    orderIds
  );

  if (value === 'Перевірити оплату') {
    const orderPromises = orderIds.map(async (id) => {
      const query = `#graphql
        query Order($id: ID!) {
          order(id: $id) {
            paymentMethod: metafield(namespace: "custom", key: "payment_method") {
              value
            }
          }
        }`;
      return makeGraphQLQuery<{ order: { paymentMethod: { value: string } } }>(
        query,
        { id }
      );
    });

    const orderResults = await Promise.all(orderPromises);
    for (const res of orderResults) {
      const paymentMethod = res.data?.order?.paymentMethod?.value;
      if (paymentMethod !== 'Передплата безготівка') {
        throw new Error(
          `Status "Перевірити оплату" is only allowed for "Передплата безготівка" payment method. Current: "${
            paymentMethod || 'None'
          }"`
        );
      }
    }
  }

  const currentTags = await getOrdersTags(orderIds);
  console.log('Current tags for the orders:', currentTags);

  if (currentTags.length > 0) {
    console.log('Removing current tags from orders...');
    const removeTagsPromises = orderIds.map((id) => {
      const removeTagsMutation = `#graphql
          mutation RemoveTags($id: ID!, $tags: [String!]!) {
            tagsRemove(id: $id, tags: $tags) {
              userErrors {
                field
                message
              }
            }
          }`;
      console.log(`Removing tags for order ${id}:`, currentTags);
      return makeGraphQLQuery(removeTagsMutation, {
        id,
        tags: currentTags,
      });
    });

    try {
      const removeTagsResults = await Promise.all(removeTagsPromises);
      console.log('Remove tags results:', removeTagsResults);
    } catch (error) {
      console.error('Error removing tags:', error);
    }
  }

  console.log('Adding new tags to orders...');
  const addTagsPromises = orderIds.map((id) => {
    const addTagsMutation = `#graphql
        mutation AddTags($id: ID!, $tags: [String!]!) {
          tagsAdd(id: $id, tags: $tags) {
            userErrors {
              field
              message
            }
            node {
              id
            }
          }
        }`;
    console.log(`Adding tag '${value}' to order ${id}`);
    return makeGraphQLQuery(addTagsMutation, {
      id,
      tags: [value],
    });
  });

  try {
    const addTagsResults = await Promise.all(addTagsPromises);
    console.log('Add tags results:', addTagsResults);
  } catch (error) {
    console.error('Error adding tags:', error);
  }

  console.log('Tags successfully updated for all orders.');
  return [value];
}

export async function getCustomerPhone(customerId: string) {
  const query = `#graphql
  query GetCustomerPhone($customerId: ID!) {
    customer(id: $customerId) {
        phone
  }
  }`;
  const { data, errors } = await makeGraphQLQuery<{
    customer: { phone: string };
  }>(query, { customerId });

  if (errors) {
    const errorMessages = errors.map((e) => e.message).join(', ');
    throw new Error(`Failed to fetch order details: ${errorMessages}`);
  }
  const phone = data?.customer?.phone;
  return phone ? phone.slice(-12) : '';
}

export async function addOrderNote({
  orderId,
  note,
}: {
  orderId: string;
  note: string;
}) {
  console.log('🚀 ~ addOrderNote:', note, orderId);
  if (!orderId) {
    throw new Error(`Order ID is required but was not provided`);
  }
  const updatedNote = note + (await makeIPMessage());
  const mutation = `#graphql
        mutation updateOrderNote($input: OrderInput!) {
            orderUpdate(input: $input) {
                order {
                    id
                    note
                }
                userErrors {
                    field
                    message
                }
            }
        }
      `;

  const { data, errors } = await makeGraphQLQuery<{
    orderUpdate: {
      order: { id: string; note: string };
      userErrors: { field: string; message: string }[];
    };
  }>(mutation, {
    input: {
      id: orderId,
      note: updatedNote,
    },
  });
  if (errors) {
    const errorMessages = errors.map((e) => e.message).join(', ');
    throw new Error(`Failed to update order note: ${errorMessages}`);
  }

  if (data?.orderUpdate?.userErrors?.length) {
    const userErrorMessages = data.orderUpdate.userErrors
      .map((e) => `${e.field}: ${e.message}`)
      .join(', ');
    throw new Error(`Failed to update order note: ${userErrorMessages}`);
  }
  return data?.orderUpdate?.order?.note || '';
}

export async function updateWarehouse({
  warehouse,
  orderId,
}: {
  warehouse: NovaPoshtaWarehouse;
  orderId: string;
}) {
  console.log('🚀 ~ warehouse:', warehouse);
  console.log('🚀 ~ orderId:', orderId);
  const metafieldMutation = `#graphql
            mutation UpdateMetafield($metafields: [MetafieldsSetInput!]!) {
              metafieldsSet(metafields: $metafields) {
                metafields {
                  id
                  value
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `;
  const variables = {
    metafields: [
      {
        ownerId: orderId,
        namespace: 'nova_poshta',
        key: 'recepient_warehouse',
        value: JSON.stringify(warehouse),
        type: 'json',
      },
    ],
  };
  const response = await makeGraphQLQuery(metafieldMutation, variables);
  return response;
}

/**
 * Save Nova Poshta declaration to order metafields
 * Supports multiple declarations per order by storing as array
 *
 * @param orderId - Shopify order GID
 * @param declaration - Declaration data to save
 * @param existingDeclarations - Array of existing declarations (optional)
 */
export async function saveDeclaration({
  orderId,
  declaration,
}: {
  orderId: string;
  declaration: {
    declarationRef: string;
    declarationNumber: string;
    estimatedDeliveryDate: string;
    cost: string;
    recipientName: string;
    cityRef: string;
    cityDescription: string;
    warehouseRef: string;
    warehouseDescription: string;
    createdAt: string;
  };
}) {
  console.log('💾 Saving declaration to order metafields:', {
    orderId,
    declarationNumber: declaration.declarationNumber,
  });

  const metafieldMutation = `#graphql
    mutation UpdateMetafield($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
          key
          value
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  // Save latest declaration to individual fields (backward compatibility)
  // Also save warehouse info separately
  const variables = {
    metafields: [
      {
        ownerId: orderId,
        namespace: 'nova_poshta',
        key: 'declaration_number',
        value: declaration.declarationNumber,
        type: 'single_line_text_field',
      },
      {
        ownerId: orderId,
        namespace: 'nova_poshta',
        key: 'declaration_ref',
        value: declaration.declarationRef,
        type: 'single_line_text_field',
      },
      {
        ownerId: orderId,
        namespace: 'nova_poshta',
        key: 'recepient_warehouse',
        value: JSON.stringify({
          cityRef: declaration.cityRef,
          cityDescription: declaration.cityDescription,
          warehouseRef: declaration.warehouseRef,
          warehouseDescription: declaration.warehouseDescription,
        }),
        type: 'json',
      },
    ],
  };

  const response = await makeGraphQLQuery(metafieldMutation, variables);

  if (response.errors || (response.data as any)?.metafieldsSet?.userErrors?.length) {
    console.error('❌ Failed to save declaration:', response);
    throw new Error('Failed to save declaration to order');
  }

  console.log('✅ Declaration saved successfully');
  return response;
}

async function makeIPMessage() {
  const response = await fetch('https://api.ipify.org?format=json');
  const data = await response.json();
  const ipMessage = data?.ip ? ` by ${data.ip}` : '';
  return ipMessage;
}

export interface OrderResponse {
  nodes: {
    id: string;
    name: string;
    createdAt: string;
    phone: string;
    tags: string[];
    customer: {
      firstName: string;
      lastName: string;
    };
    shippingAddress: {
      phone: string;
      city: string;
      address1: string;
      firstName: string;
      lastName: string;
    };
    lineItems: {
      nodes: {
        title: string;
        unfulfilledQuantity: number;
        discountedUnitPriceSet: {
          shopMoney: {
            amount: string;
          };
        };
        variant: {
          sku: string;
          barcode: string;
          inventoryItem: {
            unitCost: {
              amount: string;
            };
          };
        };
        product: {
          id: string;
          deltaMetafield: {
            value: string;
          } | null;
          warrantyMetafield: {
            value: string;
          } | null;
        };
        customAttributes: {
          key: string;
          value: string;
        }[];
      }[];
    };
    paymentMetafield: {
      value: string;
    } | null;
  }[];
}

async function fetchVariantDetails(productId: string): Promise<any | null> {
  const variantQuery = `#graphql
      query GetVariantByProductId($id: ID!) {
        product(id: $id) {
          variants(first: 1) {
            nodes {
              sku
              barcode
              inventoryItem {
                unitCost {
                  amount
                }
              }
            }
          }
        }
      }`;
  try {
    const { data, errors } = await makeGraphQLQuery<{
      product: {
        variants: {
          nodes: {
            sku: string;
            barcode: string;
            inventoryItem: {
              unitCost: {
                amount: string;
              };
            };
          }[];
        };
      };
    }>(variantQuery, {
      id: productId,
    });
    if (errors) {
      console.error('GraphQL errors fetching variant:', errors);
      return null;
    }
    return data?.product?.variants?.nodes[0] || null;
  } catch (error) {
    console.error('Error fetching variant:', error);
    return null;
  }
}

export async function fetchOrdersData(
  ids: string[]
): Promise<OrderResponse['nodes'] | null> {
  const query = `#graphql
        query GetOrdersByIds($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Order {
              id
              name
              createdAt
              phone
              tags
              customer {
                firstName
                lastName
              }
              shippingAddress {
                phone
                city
                address1
                firstName
                lastName
              }
              lineItems(first: 10) {
                nodes {
                  title
                  unfulfilledQuantity
                  discountedUnitPriceSet {
                    shopMoney {
                      amount
                    }
                  }
                  variant {
                    sku
                    barcode
                    inventoryItem {
                      unitCost {
                        amount
                      }
                    }
                  }
                  product {
                    id
                    deltaMetafield: metafield(namespace: "custom", key: "delta") {
                      value
                    }
                    warrantyMetafield: metafield(namespace: "custom", key: "warranty") {
                      value
                    }
                  }
                  customAttributes {
                    key
                    value
                  }
                }
              }
              paymentMetafield: metafield(namespace: "custom", key: "payment_method") {
                value
              }
            }
          }
        }`;

  try {
    const { data, errors } = await makeGraphQLQuery<{
      nodes: OrderResponse['nodes'];
    }>(query, { ids });
    if (errors) {
      console.error('GraphQL errors fetching orders:', errors);
      return null;
    }

    const orders = data?.nodes || null;
    if (!orders) return null;

    for (const order of orders) {
      order.lineItems.nodes = order.lineItems.nodes.filter(
        (item) => item.unfulfilledQuantity > 0
      );
    }

    // For each order's line item, if variant is null (which is a known quirk), fetch variant details using product id.
    for (const order of orders) {
      for (const item of order.lineItems.nodes) {
        if (!item.variant && item.product?.id) {
          const variantDetails = await fetchVariantDetails(item.product.id);
          if (variantDetails) {
            item.variant = variantDetails;
          }
        }
      }
    }
    return orders;
  } catch (error) {
    console.error('Error fetching orders:', error);
    return null;
  }
}
