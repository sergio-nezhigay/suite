import Shopify from 'shopify-api-node';
import { bulkMutation, currentOperationQuery } from './queries';

import { BulkOperation, UserError } from './types';
import { ShopifyProduct } from '.gadget/client/types';
import { ProductVariant } from 'api/routes/GET-feeds';

export async function getProducts(
  shopifyConnection: Shopify
): Promise<ShopifyProduct[]> {
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

export async function pollBulkOperationStatus(
  shopify: Shopify,
  bulkOperation: BulkOperation
): Promise<{ status: string; url: string | null }> {
  let status = bulkOperation.status;
  let url = null;

  while (status !== 'COMPLETED') {
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const { currentBulkOperation } = await shopify.graphql(
      currentOperationQuery
    );
    status = currentBulkOperation.status;

    if (status === 'COMPLETED') {
      url = currentBulkOperation.url;
    } else if (status === 'FAILED') {
      throw new Error('Bulk operation failed');
    }
  }

  return { status, url };
}

export async function fetchBulkOperationResults(
  bulkResultUrl: string | URL | Request
): Promise<ShopifyProduct[]> {
  const resultResponse = await fetch(bulkResultUrl);
  const resultText = await resultResponse.text();

  const resultItems = resultText
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  const productsMap: {
    [key: string]: ShopifyProduct & { variants: ProductVariant[] };
  } = {};

  resultItems.forEach((item) => {
    if (item.id && !item.__parentId) {
      productsMap[item.id] = {
        ...item,
        variants: [],
      };
    }

    if (item.__parentId) {
      if (productsMap[item.__parentId]) {
        productsMap[item.__parentId].variants.push(item);
      }
    }
  });

  const productsWithVariants = Object.values(productsMap);

  return productsWithVariants;
}
