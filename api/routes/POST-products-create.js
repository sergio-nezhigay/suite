import createProduct from '../utilities/createProduct';

export default async function route({ request, reply, connections }) {
  const shopify = connections.shopify.current;

  const { title, vendor } = request.body;

  if (!title || !vendor) {
    return await reply
      .status(400)
      .send({ error: '`title` and `vendor` parameters are required' });
  }

  try {
    const result = await createProduct({
      shopify,
      title,
      vendor,
    });
    console.log('🚀 ~ result:', result);

    if (result.error) {
      await reply.status(500).send({
        error: 'Failed to create product',
        details: result.error,
      });
    }
    await reply.send({
      status: 'Product created successfully',
      result,
    });
  } catch (error) {
    await reply.status(500).send({
      error: 'Failed to create product',
      details: error.message,
    });
  }
}
