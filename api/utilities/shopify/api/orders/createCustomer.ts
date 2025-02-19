import Shopify from 'shopify-api-node';
import { customerCreateMutation, customerSearchQuery } from './queries';

export async function findCustomer({
  shopify,
  phone,
}: {
  shopify: Shopify;
  phone: string;
}) {
  const response = await shopify.graphql(customerSearchQuery, {
    query: `phone:${phone}`,
  });

  return response.customers.edges[0]?.node || null;
}

function getPhoneTag(phone: string): string {
  const lastFourDigits = phone.replace(/\D/g, '').slice(-4);
  return `${lastFourDigits}`;
}

export async function createCustomer({
  shopify,
  variables,
}: {
  shopify: Shopify;
  variables: {
    input: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
    };
  };
}) {
  const customerInput = {
    ...variables.input,
    tags: [getPhoneTag(variables.input.phone)],
  };

  const response = await shopify.graphql(customerCreateMutation, {
    input: customerInput,
  });

  if (response.customerCreate.userErrors.length > 0) {
    throw new Error(
      `Customer creation failed: ${response.customerCreate.userErrors
        .map(
          (error: { field: string; message: string }) =>
            `${error.field}: ${error.message}`
        )
        .join(', ')}`
    );
  }

  return response.customerCreate.customer;
}
