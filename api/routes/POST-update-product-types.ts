import { connections, logger, RouteHandler } from 'gadget-server';
import { availableTypes } from 'api/utilities/data/availableTypes';

interface Product {
  id: string;
  title: string;
  description: string;
}

interface RequestBody {
  products: Product[];
}

const route: RouteHandler<{ Body: RequestBody }> = async ({
  request,
  reply,
  api,
  logger,
  connections,
}) => {
  try {
    const { products } = request.body;

    if (!Array.isArray(products) || products.length === 0) {
      await reply.code(400).send({
        error:
          "Invalid request body. Expected 'products' array with at least one product.",
      });
      return;
    }

    for (const product of products) {
      if (!product.id || !product.title || !product.description) {
        await reply.code(400).send({
          error:
            "Each product must have 'id', 'title', and 'description' fields.",
        });
        return;
      }
    }

    const results = {
      successful: [] as Array<{ id: string; productType: string }>,
      failed: [] as Array<{ id: string; error: string }>,
    };

    const shopId = connections.shopify.currentShopId?.toString();

    if (!shopId) {
      await reply.code(400).send({
        error:
          'No shop context found. This endpoint must be called from within a Shopify app context.',
      });
      return;
    }

    // 1. Determine product types for all products first
    const productTypeResults: Array<{
      id: string;
      productType?: string;
      error?: string;
    }> = [];
    for (const product of products) {
      try {
        const productType = await determineProductTypeWithOpenAI(
          product.title,
          product.description
        );
        productTypeResults.push({ id: product.id, productType });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        productTypeResults.push({ id: product.id, error: errorMessage });
      }
    }

    // 2. Prepare batch mutation for products with determined types
    const successfulProducts = productTypeResults.filter((r) => r.productType);
    const failedProducts = productTypeResults.filter((r) => r.error);

    // Shopify GraphQL does not support true batch mutations, but we can send multiple mutations in a single request using aliases
    if (successfulProducts.length > 0) {
      const mutationParts: string[] = [];
      const variables: Record<string, any> = {};

      successfulProducts.forEach((prod, idx) => {
        const alias = `update${idx}`;
        mutationParts.push(`
          ${alias}: productUpdate(input: $input${idx}) {
            product {
              id
              productType
            }
            userErrors {
              field
              message
            }
          }
        `);
        variables[`input${idx}`] = {
          id: prod.id,
          productType: prod.productType,
        };
      });

      const mutation = `
        mutation batchProductUpdate(${successfulProducts
          .map((_, idx) => `$input${idx}: ProductInput!`)
          .join(', ')}) {
          ${mutationParts.join('\n')}
        }
      `;

      await api.enqueue(api.writeToShopify, {
        shopId: shopId,
        mutation: mutation,
        variables: variables,
      });

      successfulProducts.forEach((prod) => {
        results.successful.push({
          id: prod.id,
          productType: prod.productType!,
        });
        logger.info(
          `Successfully enqueued product update for ${prod.id} with type: ${prod.productType}`
        );
      });
    }

    failedProducts.forEach((prod) => {
      results.failed.push({
        id: prod.id,
        error: prod.error!,
      });
      logger.error(
        `Failed to determine product type for ${prod.id}: ${prod.error}`
      );
    });

    await reply.send({
      summary: {
        total: products.length,
        successful: results.successful.length,
        failed: results.failed.length,
      },
      results: results,
    });
  } catch (error) {
    logger.error('Error processing product types update:', error);
    await reply.code(500).send({
      error: 'Internal server error while processing product types',
    });
  }
};

async function determineProductTypeWithOpenAI(
  title: string,
  description: string
): Promise<string> {
  try {
    const response = await connections.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: `Проаналізуй цей товар і обери ОДИН найбільш точний тип товару з наданого списку.

ТОВАР:
Назва: ${title}
Опис: ${description}

МОЖЛИВІ ТИПИ: ${availableTypes.join(', ')}

Інструкції:
- Обери лише ОДИН тип зі списку
- Будь максимально точним
- Враховуй і назву, і опис товару
`,
        },
      ],
      max_tokens: 50,
      temperature: 0,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'ProductTypeOutput',
          schema: {
            type: 'object',
            properties: {
              product_type: { type: 'string' },
            },
            required: ['product_type'],
            additionalProperties: false,
          },
          strict: true,
        },
      },
    });

    const content = response.choices[0].message.content || '{}';
    const selectedType = JSON.parse(content).product_type as string;

    console.log('selectedType', JSON.stringify(selectedType, null, 2));

    if (availableTypes.includes(selectedType)) {
      return selectedType;
    } else {
      console.log(
        `OpenAI returned unexpected type "${selectedType}", falling back to first available type`
      );
      return availableTypes[0] || 'General';
    }
  } catch (error) {
    console.log('Error calling OpenAI API:', error);
    return 'fallback-type-error';
  }
}

// Route options with body validation schema
route.options = {
  schema: {
    body: {
      type: 'object',
      properties: {
        products: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' },
            },
            required: ['id', 'title', 'description'],
          },
          minItems: 1,
        },
      },
      required: ['products'],
    },
  },
};

export default route;
