import Shopify from 'shopify-api-node';
import { orderCreateMutation } from './queries';

export async function createOrder({
  shopify,
  variables,
}: {
  shopify: Shopify;
  variables: any;
}) {
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
