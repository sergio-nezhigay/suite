import createProducts from '../utilities/createProducts';

export default async function route({ request, reply, connections }) {
  const shopify = connections.shopify.current;

  const { products } = request.body;

  if (!products || !Array.isArray(products)) {
    return await reply.status(400).send({
      error: 'Invalid or missing products array',
    });
  }

  try {
    const result = await createProducts({
      shopify,
      products,
    });

    if (result.error) {
      return await reply.status(500).send({
        error: 'Failed to create products',
        details: result.error,
      });
    } else
      return await reply.send({
        status: 'Products created successfully',
        result,
      });
  } catch (error) {
    return await reply.status(500).send({
      error: 'Failed to create products',
      details: error.message,
    });
  }
}
