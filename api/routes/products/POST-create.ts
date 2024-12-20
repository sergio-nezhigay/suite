import { Products } from 'api/types';
import createProducts from '../../utilities/createProducts';

import { RouteHandler } from 'gadget-server';

interface RequestBody {
  products?: Products;
}

const route: RouteHandler = async ({ request, reply, connections }) => {
  const { products }: RequestBody = request.body as RequestBody;

  if (!products || !Array.isArray(products)) {
    return reply
      .status(400)
      .send({ error: 'Invalid or missing products array' });
  }

  try {
    const createdProducts = await createProducts({
      products,
      connections,
    });
    return reply.send(createdProducts);
  } catch (error) {
    if (error instanceof Error) {
      return reply.status(500).send({ error: error.message });
    }
    return reply.status(500).send({ error: 'An error ' + error });
  }
};

export default route;
