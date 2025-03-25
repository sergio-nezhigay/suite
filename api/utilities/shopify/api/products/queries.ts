export const productVariantsBulkUpdateQuery = `
    mutation productVariantsBulkUpdate(
        $productId: ID!,
        $variants: [ProductVariantsBulkInput!]!
    )       {
                productVariantsBulkUpdate(productId: $productId,variants: $variants) {
                    product {
                        id
                    }
                    productVariants {
                        id
                    }
                    userErrors {
                        field
                        message
                    }
                }
}
`;

export const createProductQuery = `
mutation CreateProductWithMedia(
        $input: ProductInput!,
        $media: [CreateMediaInput!]!
    )  {
        productCreate(
            input: $input,
            media: $media
        ) {
            product {
                id
                title
                variants(first: 1) {
                    edges {
                        node {
                            id
                        }
                    }
                }
            },
            userErrors {
                field
                message
                }
        }
    }
`;

export const bulkMutation = `
    mutation {
      bulkOperationRunQuery(
        query: """
        {
          products {
            edges {
              node {
                id
                handle
                title
                vendor
                descriptionHtml
                warranty:metafield(namespace: "custom", key: "warranty") {
                  value
                }
                rozetka_filter:metafield(namespace: "custom", key: "rozetka_filter") {
                  value
                }
                rozetka_tag:metafield(namespace: "custom", key: "rozetka_tag") {
                  value
                }
                id_woocommerce:metafield(namespace: "custom", key: "id-woocommerce") {
                  value
                }
                collections(first: 1) {
                  edges {
                    node {
                      id
                      title
                    }
                  }
                }
                media(first: 10) {
                  edges {
                    node {
                      ... on MediaImage {
                        id
                        image {
                          url
                        }
                      }
                      mediaContentType
                    }
                  }
                }
                variants(first: 1) {
                  edges {
                    node {
                      price
                      sku
                      inventoryQuantity
                      barcode
                      inventoryItem {
                        unitCost {
                          amount
                        }
                      }
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

export const currentOperationQuery = `
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
