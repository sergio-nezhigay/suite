import Shopify from 'shopify-api-node';
import { bulkMutation, currentOperationQuery } from './queries';

import { BulkOperation, UserError } from './types';
import { ShopifyProduct } from '.gadget/client/types';
import { ProductVariant } from 'api/routes/GET-feeds';

export async function getProducts(
  shopifyConnection: Shopify
): Promise<ShopifyProduct[]> {
  const startTime = Date.now();

  console.log('Stage 1: Initiating bulk product query', {
    stage: 'bulk_query_start',
    timestamp: startTime,
  });
  console.log('bulkMutation', JSON.stringify(bulkMutation, null, 2));
  const { bulkOperationRunQuery } = await shopifyConnection.graphql(
    bulkMutation
  );

  console.log(
    'bulkOperationRunQuery',
    JSON.stringify(bulkOperationRunQuery, null, 2)
  );
  const { bulkOperation, userErrors } = bulkOperationRunQuery;

  if (userErrors.length > 0) {
    const errorMsg = userErrors.map((e: UserError) => e.message).join(', ');
    console.log('Stage 2: Bulk query user errors', {
      stage: 'bulk_query_error',
      duration_ms: Date.now() - startTime,
      success: false,
      error: errorMsg,
    });
    throw new Error(`Error: ${errorMsg}`);
  }

  console.log('Stage 2: Bulk query submitted successfully', {
    stage: 'bulk_query_submitted',
    duration_ms: Date.now() - startTime,
    success: true,
  });

  const bulkOperationStatus = await pollBulkOperationStatus(
    shopifyConnection,
    bulkOperation
  );

  if (bulkOperationStatus.url) {
    console.log('Stage 3: Bulk operation completed, fetching results', {
      stage: 'bulk_query_completed',
      duration_ms: Date.now() - startTime,
      success: true,
      url: bulkOperationStatus.url,
    });
    const products = await fetchBulkOperationResults(bulkOperationStatus.url);
    console.log('Stage 4: Products fetched and parsed', {
      stage: 'products_fetched',
      duration_ms: Date.now() - startTime,
      success: true,
      product_count: products.length,
    });
    return products;
  }

  console.log('Stage 3: No bulk result URL found', {
    stage: 'bulk_query_no_url',
    duration_ms: Date.now() - startTime,
    success: false,
  });
  throw new Error('No bulk result URL found');
}

export async function pollBulkOperationStatus(
  shopify: Shopify,
  bulkOperation: BulkOperation
): Promise<{ status: string; url: string | null }> {
  let status = bulkOperation.status;
  let url = null;

  while (status !== 'COMPLETED') {
    await new Promise((resolve) => setTimeout(resolve, 1000));

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
