import { AppConnections } from '.gadget/server/dist-cjs';
import { getShopifyClient } from '../../client/getShopifyClient';

interface AcceptFulfillmentOrderRequestResult {
  fulfillmentOrder?: {
    id: string;
    status: string;
    requestStatus: string;
  };
  userErrors: Array<{
    field?: string[];
    message: string;
  }>;
}

/**
 * Accepts a fulfillment request for a Shopify FulfillmentOrder.
 * @param params Object containing:
 *   - fulfillmentOrderId: Shopify FulfillmentOrder GID (e.g., "gid://shopify/FulfillmentOrder/1234567890")
 *   - connections: Shopify API connections/context
 * @returns Fulfillment order update result and user errors
 */
export async function acceptFulfillmentOrderRequest({
  fulfillmentOrderId,
  connections,
}: {
  fulfillmentOrderId: string;
  connections: AppConnections;
}): Promise<AcceptFulfillmentOrderRequestResult> {
  const shopify = getShopifyClient(connections);

  const mutation = `
    mutation AcceptFulfillmentOrderRequest($id: ID!) {
      fulfillmentOrderAcceptFulfillmentRequest(id: $id) {
        fulfillmentOrder {
          id
          status
          requestStatus
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = { id: fulfillmentOrderId };

  try {
    const response = await shopify.graphql(mutation, variables);
    const result = response?.fulfillmentOrderAcceptFulfillmentRequest || {
      userErrors: [{ message: 'Unknown error' }],
    };
    return result;
  } catch (error) {
    return { userErrors: [{ message: String(error) }] };
  }
}
