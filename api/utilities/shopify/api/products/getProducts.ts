import Shopify from 'shopify-api-node';
import { bulkMutation } from './queries';

import { Product, UserError } from './types';
import {
  pollBulkOperationStatus,
  fetchBulkOperationResults,
} from 'utilities/shopify/utils/bulkOperations';

export async function getProducts(
  shopifyConnection: Shopify
): Promise<Product[]> {
  const { bulkOperationRunQuery } = await shopifyConnection.graphql(
    bulkMutation
  );
  const { bulkOperation, userErrors } = bulkOperationRunQuery;

  if (userErrors.length > 0) {
    throw new Error(
      `Error: ${userErrors.map((e: UserError) => e.message).join(', ')}`
    );
  }

  const bulkOperationStatus = await pollBulkOperationStatus(
    shopifyConnection,
    bulkOperation
  );

  if (bulkOperationStatus.url) {
    const products = await fetchBulkOperationResults(bulkOperationStatus.url);
    return products;
  }

  throw new Error('No bulk result URL found');
}
