import Shopify from 'shopify-api-node';

interface BulkOperation {
  id: string;
  status: string;
}

interface UserError {
  field: string;
  message: string;
}

export interface ProductVariant {
  id: string;
  price: string;
  sku: string;
  title: string;
  inventoryQuantity: number;
  barcode: string;
  mediaContentType: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
  image: {
    id: string;
    url: string;
  } | null;
}

export interface Product {
  id: string;
  handle: string;
  title: string;
  vendor: string;
  descriptionHtml: string;
  warranty: { value: string } | null;
  rozetka_filter: { value: string } | null;
  rozetka_tag: { value: string } | null;
  id_woocommerce: { value: string } | null;
  collections: { edges: { node: { id: string; title: string } }[] };
  media: {
    edges: {
      node: { id: string; image: { url: string }; mediaContentType: string };
    }[];
  };
  variants: ProductVariant[];
}

export async function getProducts(
  shopifyConnection: Shopify
): Promise<Product[]> {
  const bulkMutation = `
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
    throw new Error(
      `Error: ${userErrors.map((e: UserError) => e.message).join(', ')}`
    );
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

async function pollBulkOperationStatus(
  shopify: Shopify,
  bulkOperation: BulkOperation
): Promise<{ status: string; url: string | null }> {
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

async function fetchBulkOperationResults(
  bulkResultUrl: string | URL | Request
): Promise<Product[]> {
  const resultResponse = await fetch(bulkResultUrl);
  const resultText = await resultResponse.text();

  const resultItems = resultText
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  const productsMap: {
    [key: string]: Product & { variants: ProductVariant[] };
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
