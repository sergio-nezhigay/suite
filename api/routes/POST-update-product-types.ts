import { connections, RouteHandler } from 'gadget-server';
// all products have strictly one of this available types.
import { availableTypes } from 'api/utilities/data/availableTypes';

interface Product {
  id: string;
  title: string;
  description: string;
}

interface RequestBody {
  products: Product[];
}

interface FilterResult {
  namespace: string;
  key: string;
  value: string;
}

interface OpenAIAnalysisResult {
  product_type: string;
  filters: FilterResult[];
}

const availableFilters = [
  {
    // every options refers to product metafield
    // some products may not have this metafield
    namespace: 'specifications',
    key: 'type',
    possibleValues: ['Кабель', 'Перехідник'],
    type: 'single_line_text_field',
  },
  // Add more filters as needed
  // {
  //   namespace: 'specifications',
  //   key: 'material',
  //   possibleValues: ['cotton', 'polyester', 'silk', 'wool'],
  //   type: 'single_line_text_field',
  // },
  // {
  //   namespace: 'specifications',
  //   key: 'weight',
  //   possibleValues: ['100g', '200g', '500g', '1kg'],
  //   type: 'number_integer',
  // },
];

const route: RouteHandler<{ Body: RequestBody }> = async ({
  request,
  reply,
  api,
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
      successful: [] as Array<{
        id: string;
        productType: string;
        filters: FilterResult[];
      }>,
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

    // 1. Determine product types and filters for all products first
    const analysisResults: Array<{
      id: string;
      productType?: string;
      filters?: FilterResult[];
      error?: string;
    }> = [];

    for (const product of products) {
      try {
        const analysis = await analyzeProductWithOpenAI(
          product.title,
          product.description
        );
        analysisResults.push({
          id: product.id,
          productType: analysis.product_type,
          filters: analysis.filters,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        analysisResults.push({ id: product.id, error: errorMessage });
      }
    }

    // 2. Prepare batch mutation for products with successful analysis
    const successfulProducts = analysisResults.filter((r) => r.productType);
    const failedProducts = analysisResults.filter((r) => r.error);

    // Process successful products
    if (successfulProducts.length > 0) {
      const mutationParts: string[] = [];
      const variables: Record<string, any> = {};

      successfulProducts.forEach((prod, idx) => {
        const alias = `update${idx}`;

        // Prepare metafields for this product
        const metafields =
          prod.filters?.map((filter) => {
            const filterConfig = availableFilters.find(
              (af) => af.namespace === filter.namespace && af.key === filter.key
            );
            return {
              namespace: filter.namespace,
              key: filter.key,
              value: filter.value,
              type: filterConfig?.type || 'single_line_text_field',
            };
          }) || [];

        mutationParts.push(`
          ${alias}: productUpdate(input: $input${idx}) {
            product {
              id
              productType
              metafields(first: 20) {
                edges {
                  node {
                    id
                    namespace
                    key
                    value
                  }
                }
              }
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
          ...(metafields.length > 0 && { metafields }),
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
          filters: prod.filters || [],
        });
        console.log(
          `Successfully enqueued product update for ${prod.id} with type: ${
            prod.productType
          } and ${prod.filters?.length || 0} filters`
        );
      });
    }

    failedProducts.forEach((prod) => {
      results.failed.push({
        id: prod.id,
        error: prod.error!,
      });
      console.error(`Failed to analyze product ${prod.id}: ${prod.error}`);
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
    console.error('Error processing product types and filters update:', error);
    await reply.code(500).send({
      error: 'Internal server error while processing product analysis',
    });
  }
};

async function analyzeProductWithOpenAI(
  title: string,
  description: string
): Promise<OpenAIAnalysisResult> {
  try {
    // Prepare filter descriptions for the prompt
    const filterDescriptions = availableFilters
      .map(
        (filter) =>
          `- ${filter.namespace}.${
            filter.key
          }: possible values [${filter.possibleValues.join(', ')}]`
      )
      .join('\n');

    const response = await connections.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: `Проаналізуй цей товар і визнач:
1. ОДИН найбільш точний тип товару з наданого списку
2. Підходящі значення фільтрів (якщо є відповідна інформація)

ТОВАР:
Назва: ${title}
Опис: ${description}

МОЖЛИВІ ТИПИ ТОВАРІВ: ${availableTypes.join(', ')}

ДОСТУПНІ ФІЛЬТРИ:
${filterDescriptions}

Інструкції:
- Обери лише ОДИН тип зі списку типів товарів
- Для фільтрів: включай лише ті, для яких є чітка інформація в назві/описі товару
- Використовуй точно ті значення, що вказані в possibleValues
- Якщо інформації для фільтра немає - не включай його
- Будь максимально точним`,
        },
      ],
      max_tokens: 150,
      temperature: 0,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'ProductAnalysisOutput',
          schema: {
            type: 'object',
            properties: {
              product_type: { type: 'string' },
              filters: {
                type: ['array', 'null'],
                items: {
                  type: 'object',
                  properties: {
                    namespace: { type: 'string' },
                    key: { type: 'string' },
                    value: { type: 'string' },
                    type: { type: 'string', default: 'single_line_text_field' },
                  },
                  required: ['namespace', 'key', 'value', 'type'],
                  additionalProperties: false,
                },
              },
            },
            required: ['product_type', 'filters'],
            additionalProperties: false,
          },
          strict: true,
        },
      },
    });

    const content = response.choices[0].message.content || '{}';
    const analysis = JSON.parse(content) as OpenAIAnalysisResult;

    console.log('OpenAI Analysis Result:', JSON.stringify(analysis, null, 2));

    // Validate product type
    if (!availableTypes.includes(analysis.product_type)) {
      console.log(
        `OpenAI returned unexpected type "${analysis.product_type}", falling back to first available type`
      );
      analysis.product_type = availableTypes[0] || 'General';
    }

    // Validate filters
    const validatedFilters: FilterResult[] = [];
    if (analysis.filters && Array.isArray(analysis.filters)) {
      for (const filter of analysis.filters) {
        if (filter.namespace.includes('.')) {
          const [namespace, key] = filter.namespace.split('.', 2);
          filter.namespace = namespace;
          filter.key = key;
        }

        const availableFilter = availableFilters.find(
          (af) => af.namespace === filter.namespace && af.key === filter.key
        );

        if (
          availableFilter &&
          availableFilter.possibleValues.includes(filter.value)
        ) {
          validatedFilters.push(filter);
        } else {
          console.log(
            `Invalid filter: ${filter.namespace}.${filter.key} = ${filter.value}`
          );
        }
      }
    }

    return {
      product_type: analysis.product_type,
      filters: validatedFilters,
    };
  } catch (error) {
    console.log('Error calling OpenAI API:', error);
    return {
      product_type: 'fallback-type-error',
      filters: [],
    };
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
