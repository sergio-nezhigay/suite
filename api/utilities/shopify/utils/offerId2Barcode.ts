import Shopify from 'shopify-api-node';

export const offerId2Barcode = async (offerId: string, shopify: Shopify) => {
  if (!offerId) {
    console.warn(`[offerId2Barcode] No offerId provided`);
    return '';
  }
  let productId = offerId;

  if (!offerId.includes('gid://shopify/Product/')) {
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
      if (response.products.edges.length > 0) {
        productId = response.products.edges[0].node.id;
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
  }

  // Fetch barcode using product ID
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
    const barcode =
      barcodeResponse?.product?.variants?.edges[0]?.node?.barcode || '';

    if (barcode) {
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

