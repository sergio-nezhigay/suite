export default async function createProducts({ shopify, products }) {
  const query = `
    mutation CreateProduct(
      $title: String!,
      $vendor: String!
    ) {
      productCreate(
        input: {
          title: $title,
          vendor: $vendor
        }
      ) {
        product {
          id
          title
          vendor
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  if (!shopify || !shopify.graphql) {
    throw new Error('Shopify object or GraphQL client is not available.');
  }

  for (const product of products) {
    const variables = {
      title: product.title,
      vendor: product.vendor,
    };

    try {
      const response = await shopify.graphql(query, variables);

      // Log the entire response for debugging
      console.log('GraphQL Response:', JSON.stringify(response, null, 2));

      // Extract throttleStatus safely
      const throttleStatus = response.extensions?.cost?.throttleStatus;

      if (!throttleStatus) {
        console.warn('⚠️ Throttle status not found in response.');
      } else {
        console.log(`Throttle Status:
          - Maximum Available: ${throttleStatus.maximumAvailable}
          - Currently Available: ${throttleStatus.currentlyAvailable}
          - Restore Rate: ${throttleStatus.restoreRate}`);
      }

      // Handle API limits
      if (throttleStatus?.currentlyAvailable < 10) {
        const waitTime = (1000 / throttleStatus.restoreRate) * 1000; // in ms
        console.log(`⚠️ Approaching rate limit. Pausing for ${waitTime}ms.`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }

      if (response.productCreate.userErrors?.length) {
        console.error('❌ User Errors:', response.productCreate.userErrors);
      } else {
        console.log(
          `✅ Created product: ${response.productCreate.product.title}`
        );
      }
    } catch (error) {
      console.error(`❌ Error creating product: ${error.message}`);
    }
  }
}
