import { RouteHandler } from 'gadget-server';

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

    // Validate products array
    if (!Array.isArray(products) || products.length === 0) {
      await reply.code(400).send({
        error:
          "Invalid request body. Expected 'products' array with at least one product.",
      });
      return;
    }

    // Validate each product has required fields
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

    // Get current shop ID
    const shopId = connections.shopify.currentShopId?.toString();

    if (!shopId) {
      await reply.code(400).send({
        error:
          'No shop context found. This endpoint must be called from within a Shopify app context.',
      });
      return;
    }

    // Process each product
    for (const product of products) {
      try {
        // Determine product type using simple keyword matching
        const productType = determineProductType(
          product.title,
          product.description
        );

        // Create GraphQL mutation string to update product_type
        const mutation = `
          mutation productUpdate($input: ProductInput!) {
            productUpdate(input: $input) {
              product {
                id
                productType
              }
              userErrors {
                field
                message
              }
            }
          }
        `;

        const variables = {
          input: {
            id: product.id,
            productType: productType,
          },
        };

        await api.enqueue(api.writeToShopify, {
          shopId: shopId,
          mutation: mutation,
          variables: variables,
        });

        results.successful.push({
          id: product.id,
          productType: productType,
        });

        logger.info(
          `Successfully enqueued product update for ${product.id} with type: ${productType}`
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        results.failed.push({
          id: product.id,
          error: errorMessage,
        });

        logger.error(
          `Failed to enqueue product update for ${product.id}: ${errorMessage}`
        );
      }
    }

    // Return summary
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

// Function to determine product type based on keywords
function determineProductType(title: string, description: string): string {
  const text = (title + ' ' + description).toLowerCase();

  // Define keyword mappings
  const typeKeywords = {
    Clothing: [
      'shirt',
      'pants',
      'dress',
      'jacket',
      'shoes',
      'clothing',
      'apparel',
      'wear',
      'fashion',
    ],
    Books: [
      'book',
      'novel',
      'textbook',
      'manual',
      'guide',
      'literature',
      'reading',
    ],
    Electronics: [
      'electronics',
      'computer',
      'phone',
      'laptop',
      'tablet',
      'headphones',
      'speaker',
      'tech',
      'digital',
    ],
    'Home & Garden': [
      'home',
      'garden',
      'furniture',
      'decor',
      'kitchen',
      'bathroom',
      'tools',
      'appliance',
    ],
    Sports: [
      'sports',
      'fitness',
      'exercise',
      'gym',
      'athletic',
      'outdoor',
      'recreation',
    ],
    Beauty: [
      'beauty',
      'cosmetics',
      'skincare',
      'makeup',
      'health',
      'personal care',
    ],
    Toys: ['toy', 'game', 'puzzle', 'children', 'kids', 'play', 'educational'],
    Food: [
      'food',
      'snack',
      'beverage',
      'drink',
      'organic',
      'nutrition',
      'supplement',
    ],
  };

  // Check for keyword matches
  for (const [type, keywords] of Object.entries(typeKeywords)) {
    if (keywords.some((keyword) => text.includes(keyword))) {
      return type;
    }
  }

  // Default product type if no keywords match
  return 'General';
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
