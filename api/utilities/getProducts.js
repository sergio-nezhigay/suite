import { prepareProductDescription } from './prepareProductDescription';

export async function getProducts(shopifyConnection) {
  const bulkMutation = `
     mutation {
  bulkOperationRunQuery(
    query: """
    {
      products {
        edges {
          node {
            id
            title
            vendor
    	descriptionHtml
            variants(first: 1) {
              edges {
                node {
                  price
                  sku
                }
              }
            }
          }
        }
      }
    }
    """
  ) {
    bulkOperation {
      id
      status
    }
    userErrors {
      field
      message
    }
  }
}

    `;

  const { bulkOperationRunQuery } = await shopifyConnection.graphql(
    bulkMutation
  );
  const { bulkOperation, userErrors } = bulkOperationRunQuery;

  if (userErrors.length > 0) {
    throw new Error(`Error: ${userErrors.map((e) => e.message).join(', ')}`);
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

async function pollBulkOperationStatus(shopify, bulkOperation) {
  let status = bulkOperation.status;
  let url = null;

  while (status !== 'COMPLETED') {
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const currentOperationQuery = `
        {
          currentBulkOperation {
            id
            status
            url
            errorCode
            objectCount
          }
        }
      `;

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

async function fetchBulkOperationResults(bulkResultUrl) {
  const resultResponse = await fetch(bulkResultUrl);
  const resultText = await resultResponse.text();

  const resultItems = resultText
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  const productsMap = {};

  resultItems.forEach((item) => {
    if (item.id && !item.__parentId) {
      const cleanDescription = prepareProductDescription(
        item.descriptionHtml || ''
      );
      productsMap[item.id] = {
        ...item,
        description: cleanDescription,
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
