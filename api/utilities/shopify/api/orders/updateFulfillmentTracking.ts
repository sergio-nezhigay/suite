import { AppConnections } from '.gadget/server/dist-cjs';
import { getShopifyClient } from '../../client/getShopifyClient';

interface TrackingInfoInput {
  company?: string;
  number: string;
  url?: string;
}

interface UpdateTrackingResult {
  fulfillment?: {
    id: string;
    status: string;
    trackingInfo: Array<{
      company?: string;
      number: string;
      url?: string;
    }>;
  };
  userErrors: Array<{
    field?: string[];
    message: string;
  }>;
}

/**
 * Updates tracking info for a Shopify fulfillment.
 * @param params Object containing:
 *   - fulfillmentId: Shopify fulfillment GID (e.g., "gid://shopify/Fulfillment/6127986737468")
 *   - trackingInfo: Tracking info input (company, number, url)
 *   - notifyCustomer: Whether to notify the customer
 *   - connections: Shopify API connections/context
 * @returns Fulfillment update result and user errors
 */
export async function updateFulfillmentTracking({
  fulfillmentId,
  trackingInfo,
  notifyCustomer,
  connections,
}: {
  fulfillmentId: string;
  trackingInfo: TrackingInfoInput;
  notifyCustomer: boolean;
  connections: AppConnections;
}): Promise<UpdateTrackingResult> {
  const shopify = getShopifyClient(connections);

  const mutation = `
    mutation UpdateFulfillmentTracking(
      $fulfillmentId: ID!,
      $trackingInfoInput: FulfillmentTrackingInput!,
      $notifyCustomer: Boolean!
    ) {
      fulfillmentTrackingInfoUpdate(
        fulfillmentId: $fulfillmentId,
        trackingInfoInput: $trackingInfoInput,
        notifyCustomer: $notifyCustomer
      ) {
        fulfillment {
          id
          status
          trackingInfo(first: 5) {
            company
            number
            url
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    fulfillmentId,
    trackingInfoInput: trackingInfo,
    notifyCustomer,
  };

  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      console.log(
        'updateFulfillmentTracking variables',
        JSON.stringify(variables, null, 2)
      );
      console.log(
        'updateFulfillmentTracking mutation',
        JSON.stringify(mutation, null, 2)
      );
      const response = await shopify.graphql(mutation, variables);

      console.log(
        'updateFulfillmentTracking response',
        JSON.stringify(response, null, 2)
      );
      const result = response?.fulfillmentTrackingInfoUpdate || {
        userErrors: [{ message: 'Unknown error' }],
      };

      // Retry only if userErrors are present and not empty
      if (
        result.userErrors &&
        result.userErrors.length > 0 &&
        attempt < maxRetries - 1
      ) {
        console.warn(
          `User errors encountered on attempt ${attempt + 1}:`,
          JSON.stringify(result.userErrors, null, 2)
        );
        attempt++;
        await new Promise((res) => setTimeout(res, 1000 * attempt)); // Exponential backoff
        continue;
      }

      return result;
    } catch (error) {
      console.error('Error updating fulfillment tracking:', error);
      if (attempt >= maxRetries - 1) {
        return { userErrors: [{ message: String(error) }] };
      }
      attempt++;
      await new Promise((res) => setTimeout(res, 1000 * attempt));
    }
  }

  return { userErrors: [{ message: 'Max retry attempts reached' }] };
}
