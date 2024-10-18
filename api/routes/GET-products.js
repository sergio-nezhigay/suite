export default async function route({ request, reply, connections }) {
  const shopify = connections.shopify.current;

  // Step 1: Start Bulk Operation
  const bulkMutation = `mutation {
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
    }`;

  // Execute the bulk operation
  const { bulkOperationRunQuery } = await shopify.graphql(bulkMutation);
  const { bulkOperation, userErrors } = bulkOperationRunQuery;

  // Handle user errors if any
  if (userErrors.length > 0) {
    return reply.status(400).send({ error: userErrors });
  }

  const operationId = bulkOperation.id;
  console.log('🚀 ~ bulkOperation started with ID:', operationId);

  // Step 2: Poll for completion
  let operationStatus = bulkOperation.status;
  let bulkResultUrl = null;

  while (operationStatus !== 'COMPLETED') {
    // Poll the current bulk operation status every 5 seconds
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const currentOperationQuery = `{
        currentBulkOperation {
          id
          status
          url
          errorCode
          objectCount
        }
      }`;

    const { currentBulkOperation } = await shopify.graphql(
      currentOperationQuery
    );

    operationStatus = currentBulkOperation.status;
    console.log(`🚀 ~ Current operation status: ${operationStatus}`);

    if (operationStatus === 'COMPLETED') {
      bulkResultUrl = currentBulkOperation.url;
    } else if (operationStatus === 'FAILED') {
      return reply.status(500).send({ error: 'Bulk operation failed' });
    }
  }

  // Step 3: Download the result from the URL
  if (bulkResultUrl) {
    console.log(
      `🚀 ~ Bulk operation completed. Downloading results from: ${bulkResultUrl}`
    );

    // Fetch the results (JSON Lines format)
    const resultResponse = await fetch(bulkResultUrl);
    const resultText = await resultResponse.text();

    // Process the JSON Lines (JSONL) data
    const products = resultText
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line)); // Parsing each line into JSON

    // Step 4: Return the parsed product data
    return reply.send({ products });
  }

  return reply.status(500).send({ error: 'No bulk result URL found' });
}
