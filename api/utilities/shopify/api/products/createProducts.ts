import { AppConnections } from 'gadget-server';
import axios from 'axios';

import { Products, ProductOptions } from 'types/index';

import { createProductQuery, productVariantsBulkUpdateQuery } from './queries';

import {
  fetchChatGPT,
  getShopifyClient,
  transliterate,
  preparePrompt,
  parseGeneratedDescription,
} from 'utilities';

async function getDefaultImageUrl(title: string): Promise<string> {
  try {
    const response = await axios.get(
      'https://www.googleapis.com/customsearch/v1',
      {
        params: {
          key: process.env.GOOGLE_API_KEY,
          cx: process.env.GOOGLE_CX,
          q: title,
          searchType: 'image',
          num: 1,
          safe: 'active',
        },
      }
    );

    const items = response.data.items;
    if (items && items.length > 0) {
      return items[0].link;
    }

    return 'https://www.zip.ua/wp-content/uploads/woocommerce-placeholder.png';
  } catch (error) {
    console.error(error);
    return 'https://www.zip.ua/wp-content/uploads/woocommerce-placeholder.png';
  }
}

export async function createProducts({
  products,
  connections,
}: {
  products: Products;
  connections: AppConnections;
}) {
  const createdProducts = [];
  try {
    const shopify = getShopifyClient(connections);
    for (const product of products) {
      console.log('product', JSON.stringify(product, null, 2));
      const handle = transliterate(product.title);
      const prompt = preparePrompt(product.title, product.description);
      const response = (await fetchChatGPT({ prompt, connections })) || '';
      const { title, html, vendor } = parseGeneratedDescription(response);

      let media;
      if (Array.isArray(product.pictures) && product.pictures.length > 0) {
        media = product.pictures.map((picture) => ({
          mediaContentType: 'IMAGE',
          originalSource: picture,
        }));
      } else {
        const imageUrl = await getDefaultImageUrl(product.part_number);
        media = [
          {
            mediaContentType: 'IMAGE',
            originalSource: imageUrl,
          },
        ];
      }

      const createProductVariables = {
        input: {
          title: title,
          vendor: product.vendor || vendor || '',
          descriptionHtml: html || null,
          handle,
          metafields: mapObjectToMetafields(product?.options),
          published: true,
        },
        media,
      };
      console.log(
        'createProductVariables',
        JSON.stringify(createProductVariables, null, 2)
      );
      const { productCreate } = await shopify.graphql(
        createProductQuery,
        createProductVariables
      );

      if (productCreate?.userErrors && productCreate?.userErrors.length > 0) {
        console.log('🚀 ~ productCreate userErrors:', productCreate.userErrors);
        throw new Error(
          'Failed to create a product' +
            JSON.stringify(productCreate.userErrors)
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
          'Failed to update variant.' + productVariantsBulkUpdate.userErrors
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

function mapObjectToMetafields(metaObject: ProductOptions | undefined): Array<{
  namespace: string;
  key: string;
  type: string;
  value: string;
}> | null {
  if (!metaObject) return null;

  const ATTRIBUTE_MAPPINGS = {
    '777': { namespace: 'custom', keys: ['1110', '1430', '33321'] }, // Interface
    '773': { namespace: 'custom', keys: ['773', '4767', '682', '730'] }, // Volume
    '1441': {
      namespace: 'custom',
      keys: ['1441', '18915', '87', '20829', '11603'],
    }, // Subtype
    '9279': {
      namespace: 'custom',
      keys: [
        '9279',
        '4764',
        '1456',
        '374',
        '84',
        '20841',
        '737',
        '13456',
        '11598',
      ],
    }, // Type
    inputs: {
      namespace: 'custom',
      keys: ['9491', '380', '7336', '20840', '9829'],
    },
    outputs: { namespace: 'custom', keys: ['9492', '669', '9834', '11601'] },
    color: {
      namespace: 'custom',
      keys: ['18525', '17191', '19252', '20830', '17211', '17163'],
    },
    features: {
      namespace: 'custom',
      keys: ['1146', '385', '7335', '20835', '738', '19351'],
    },
    length: { namespace: 'custom', keys: ['20823', '6387'] },
    width: { namespace: 'custom', keys: ['20824', '32458'] },
  };

  const getAttributeMapping = (
    searchedValue: string
  ): { key: string; namespace: string } => {
    for (const [key, mapping] of Object.entries(ATTRIBUTE_MAPPINGS)) {
      if (mapping.keys.includes(searchedValue)) {
        return { key, namespace: mapping.namespace };
      }
    }
    return { key: searchedValue, namespace: 'custom' }; // Default namespace if not found
  };

  return Object.keys(metaObject).map((metaKey) => {
    const { key, namespace } = getAttributeMapping(metaKey);

    return {
      namespace,
      key,
      type: 'list.single_line_text_field',
      value: JSON.stringify(metaObject[metaKey].valueNames),
    };
  });
}
