import { ProductOptions, Products } from 'api/types';
import Shopify from 'shopify-api-node';
import transliterate from './transliterate';
import fetchChatGPT from './fetchChatGPT';
import parseGeneratedDescription from './parseGeneratedDescription';
import preparePrompt from './preparePrompt';

const createProductQuery = `
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

const productVariantsBulkUpdateQuery = `
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

export default async function createProducts({
  shopify,
  products,
}: {
  shopify: Shopify;
  products: Products;
}) {
  const createdProducts = [];

  try {
    for (const product of products) {
      const handle = transliterate(product.title);
      const prompt = preparePrompt(product.title, product.description);
      const response = (await fetchChatGPT(prompt)) || '';
      const { title, html } = parseGeneratedDescription(response);

      const media = Array.isArray(product.pictures)
        ? product.pictures.map((picture) => ({
            mediaContentType: 'IMAGE',
            originalSource: picture,
          }))
        : [];

      const createProductVariables = {
        input: {
          title: title,
          vendor: product.vendor,
          descriptionHtml: html || null,
          handle,

          metafields: object2metafields(product?.options),
        },
        media,
      };

      const { productCreate } = await shopify.graphql(
        createProductQuery,
        createProductVariables
      );

      if (!productCreate?.product) {
        throw new Error(
          'Failed to create one or more products.',
          productCreate
        );
      }

      const updateVariantBulkVariables = {
        productId: productCreate.product?.id,
        variants: [
          {
            id: productCreate.product?.variants.edges[0].node.id,
            inventoryItem: { tracked: true },
            barcode: product?.part_number.toLowerCase() || '',
            price: product?.price || 0,
          },
        ],
      };

      const { productVariantsBulkUpdate } = await shopify.graphql(
        productVariantsBulkUpdateQuery,
        updateVariantBulkVariables
      );

      if (!productVariantsBulkUpdate?.productVariants) {
        throw new Error(
          'Failed to update variant.',
          productVariantsBulkUpdate.userErrors
        );
      }

      createdProducts.push(productCreate.product);
    }

    return {
      message: 'Products created successfully',
      createdProducts,
    };
  } catch (error) {
    console.error('Create/update Error:', error);
    throw error;
  }
}

function object2metafields(metaObject: ProductOptions | undefined): Array<{
  namespace: string;
  key: string;
  type: string;
  value: string;
}> | null {
  if (!metaObject) return null;

  const KEYS: Record<string, string[]> = {
    '773': ['773', '4767'], // Volume
    '9279': ['9279', '4764'], // Type
  };

  const findMetaKey = (searchedValue: string): string => {
    for (const [key, value] of Object.entries(KEYS)) {
      if (value.includes(searchedValue)) {
        return key;
      }
    }
    return searchedValue;
  };

  return Object.keys(metaObject).map((metaKey) => {
    const key = findMetaKey(metaKey);
    const meta = {
      namespace: 'custom',
      key,
      type: 'list.single_line_text_field',
      value: JSON.stringify(metaObject[metaKey].valueNames),
    };
    console.log('🚀 ~ meta:', meta);
    return meta;
  });
}
