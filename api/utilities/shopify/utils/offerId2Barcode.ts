import Shopify from 'shopify-api-node';

export const offerId2Barcode = async (offerId: string, shopify: Shopify) => {
  if (!offerId) {
    console.warn(`[offerId2Barcode] No offerId provided`);
    return '';
  }

  console.log(`[offerId2Barcode] Processing offerId: ${offerId}`);

  let productId = offerId;

  if (!offerId.includes('gid://shopify/Product/')) {
    console.log(
      `[offerId2Barcode] offerId is NOT a Shopify GID. Searching for product ID...`
    );

    // Find product ID using metafield lookup
    const query = `
        query getProducts($query: String!) {
          products(first: 1, query: $query) {
            edges {
              node {
                id
                title
              }
            }
          }
        }
      `;

    const variables = { query: `metafields.custom.id-woocommerce:${offerId}` };

    try {
      const response = await shopify.graphql(query, variables);
      console.log(
        `[offerId2Barcode] Shopify response for product search:`,
        response
      );

      if (response.products.edges.length > 0) {
        productId = response.products.edges[0].node.id;
        console.log(`[offerId2Barcode] Found Shopify product ID: ${productId}`);
      } else {
        console.warn(
          `[offerId2Barcode] No product found for offerId: ${offerId}`
        );
        return '';
      }
    } catch (error) {
      console.error(`[offerId2Barcode] Error fetching product ID:`, error);
      return '';
    }
  } else {
    console.log(
      `[offerId2Barcode] offerId is already a Shopify GID: ${offerId}`
    );
  }

  // Fetch barcode using product ID
  console.log(
    `[offerId2Barcode] Fetching barcode for product ID: ${productId}`
  );

  const barcodeQuery = `
      query getProductBarcode($id: ID!) {
        product(id: $id) {
          title
          variants(first: 1) {
            edges {
              node {
                barcode
              }
            }
          }
        }
      }
    `;

  try {
    const barcodeResponse = await shopify.graphql(barcodeQuery, {
      id: productId,
    });
    console.log(
      `[offerId2Barcode] Shopify response for barcode lookup:`,
      barcodeResponse
    );

    const barcode =
      barcodeResponse?.product?.variants?.edges[0]?.node?.barcode || '';

    if (barcode) {
      console.log(
        `[offerId2Barcode] Found barcode: ${barcode} for product ID: ${productId}`
      );
    } else {
      console.warn(
        `[offerId2Barcode] No barcode found for product ID: ${productId}`
      );
    }

    return barcode || 'test-barcode';
  } catch (error) {
    console.error(`[offerId2Barcode] Error fetching barcode:`, error);
    return '';
  }
};

