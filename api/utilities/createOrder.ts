import Shopify from 'shopify-api-node';

export async function createOrder({
  shopify,
  variables,
}: {
  shopify: Shopify;
  variables: any;
}) {
  const orderCreateMutation = `
    mutation OrderCreate($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
      orderCreate(order: $order, options: $options) {
        userErrors {
          field
          message
        }
        order {
          id
          name
          customer {
            firstName
            lastName
            email
            addresses {
              address1
              city
            }
          }
          lineItems(first: 5) {
            nodes {
              id
              title
              quantity
            }
          }
          shippingAddress {
            address1
            city
            phone
          }
            transactions {
                gateway
            }
        }
      }
    }
  `;

  const response = await shopify.graphql(orderCreateMutation, variables);

  if (response.orderCreate.userErrors.length > 0) {
    throw new Error(
      `Order creation failed: ${response.orderCreate.userErrors
        .map(
          (error: { field: string; message: string }) =>
            `${error.field}: ${error.message}`
        )
        .join(', ')}`
    );
  }

  return response.orderCreate.order;
}
