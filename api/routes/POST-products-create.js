import createProducts from '../utilities/createProducts';

export default async function route({ request, reply, connections }) {
  connections.shopify.maxRetries = 10;
  const shopify = connections.shopify.current;

  const { products } = request.body;

  if (!products || !Array.isArray(products)) {
    return reply
      .status(400)
      .send({ error: 'Invalid or missing products array' });
  }

  try {
    const createdProducts = await createProducts({ shopify, products });
    return reply.send(createdProducts);
  } catch (error) {
    return reply.status(500).send({ error: error.message });
  }
}
