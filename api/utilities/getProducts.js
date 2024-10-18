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
              productType
              variants(first: 10) {
                edges {
                  node {
                    id
                    title
                    price
                    sku
                  }
                }
              }
              tags
              status
              publishedAt
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

  return resultText
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}
