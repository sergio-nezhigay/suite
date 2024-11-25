import { Products } from 'api/types';
import Shopify from 'shopify-api-node';

export default async function flagExistingShopifyProducts(
  shopify: Shopify,
  products: Products
) {
  const existingProductQuery = `
    query CheckProductByQuery(
    $query: String!,
  ) {
      productVariants(
        first: 1, query: $query,
      ) {
          edges {
            node {
              id
              barcode
            }
          }

        }
    }
  `;

  const productsWithPresenceFlag = [];
  for (const product of products) {
    const { productVariants } = await shopify.graphql(existingProductQuery, {
      query: `barcode:${product?.part_number} AND vendor:${product?.vendor}`,
    });

    const checkedProduct = {
      ...product,
      existsInShopify: productVariants?.edges.length > 0,
    };
    productsWithPresenceFlag.push(checkedProduct);
  }
  return productsWithPresenceFlag;
}
