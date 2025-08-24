import { getShopifyClient } from '../../client/getShopifyClient';
import type { AppConnections } from 'gadget-server';

interface TrackingInfo {
  company: string | null;
  number: string | null;
  url: string | null;
}

interface Fulfillment {
  id: string;
  status: string;
  name: string;
  createdAt: string;
  trackingInfo: TrackingInfo[];
}

/**
 * Fetches fulfillments for a given Shopify order ID, including tracking info.
 * @param orderId Shopify order GID (e.g., "gid://shopify/Order/6887896023356")
 * @param connections Shopify API connections/context
 * @returns Array of fulfillments with id, status, name, createdAt, and trackingInfo
 */
export async function fetchFulfillments(
  orderId: string,
  connections: AppConnections
): Promise<Fulfillment[]> {
  const shopify = getShopifyClient(connections);

  const gid = orderId.startsWith('gid://')
    ? orderId
    : `gid://shopify/Order/${orderId}`;

  const query = `
    query GetFulfillments($id: ID!) {
      order(id: $id) {
        fulfillments(first: 10) {
          id
          status
          name
          createdAt
          trackingInfo(first: 10) {
            company
            number
            url
          }
        }
      }
    }
  `;
  const variables = { id: gid };

  try {
    const response = await shopify.graphql(query, variables);
    console.log('variables: ', JSON.stringify(variables, null, 2));
    console.log(
      'response  of order id: ',
      orderId,
      JSON.stringify(response, null, 2)
    );
    return response?.order?.fulfillments || [];
  } catch (error) {
    console.error('Error fetching fulfillments:', error);
    return [];
  }
}
