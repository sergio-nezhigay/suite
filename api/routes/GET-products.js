export default async function route({ request, reply, connections }) {
  const shopify = connections.shopify.current;

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

  const { bulkOperationRunQuery } = await shopify.graphql(bulkMutation);
  const { bulkOperation, userErrors } = bulkOperationRunQuery;

  if (userErrors.length > 0) {
    return reply.status(400).send({ error: userErrors });
  }

  const bulkOperationStatus = await pollBulkOperationStatus(
    shopify,
    bulkOperation
  );

  if (bulkOperationStatus.url) {
    const products = await fetchBulkOperationResults(bulkOperationStatus.url);
    return reply.send({ products });
  }

  return reply.status(500).send({ error: 'No bulk result URL found' });
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
