import { RouteHandler } from 'gadget-server';
import { findBestVariant } from '../utilities/data/findBestVariant';

const route: RouteHandler<{
  Querystring: {
    productTitle: string;
  };
}> = async ({ request, reply }) => {
  try {
    const { productTitle } = request.query;

    if (!productTitle) {
      return reply.status(400).send({
        error: 'productTitle query parameter is required'
      });
    }

    const bestVariant = findBestVariant(productTitle);

    return reply.send({
      productTitle,
      bestVariant
    });
  } catch (error) {
    console.log('Error in findBestVariant route:', error);
    return reply.status(500).send({
      error: 'Internal server error'
    });
  }
};

export default route;