import { Products } from 'api/types';
import createProducts from '../../utilities/createProducts';
import getShopifyClient from '../../utilities/getShopifyClient';
import { RouteHandler } from 'gadget-server';

interface RequestBody {
  products?: Products;
}

const route: RouteHandler = async ({ request, reply, connections }) => {
  const shopify = getShopifyClient(connections);
  //  if (!shopify)
  //    return reply.status(400).send({ error: 'Missing Shopify object' });
  const { products }: RequestBody = request.body as RequestBody;

  if (!products || !Array.isArray(products)) {
    return reply
      .status(400)
      .send({ error: 'Invalid or missing products array' });
  }

  try {
    const createdProducts = await createProducts({ shopify, products });
    return reply.send(createdProducts);
  } catch (error) {
    if (error instanceof Error) {
      return reply.status(500).send({ error: error.message });
    }
    return reply.status(500).send({ error: 'An unknown error occurred' });
  }
};

export default route;
