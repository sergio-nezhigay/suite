import { FastifyReply, FastifyRequest } from 'fastify';

import {
  getShopifyClient,
  fetchEasy,
  fetchCherg,
  fetchSchusev,
  fetchBrainProducts,
  flagExistingShopifyProducts,
  getUrlParams,
} from 'utilities';
import { connections } from '.gadget/server/types';

const route = async (
  request: FastifyRequest<{
    Querystring: {
      query?: string;
      limit?: string;
      page?: string;
      supplierId?: string;
      categoryId?: string;
    };
  }>,
  reply: FastifyReply
) => {
  try {
    const shopify = getShopifyClient(connections);
    const {
      query = '',
      limit = '50',
      page = '1',
      supplierId,
      categoryId,
    } = getUrlParams(request);
    console.log('route { supplierId,query, limit, page, categoryId } ', {
      supplierId,
      query,
      limit,
      page,
      categoryId,
    });
    let products = [],
      count = 0,
      productsWithExistingFlag;

    switch (supplierId) {
      case 'easy':
        ({ products, count } = await fetchEasy({
          query,
          limit,
          page,
        }));
        break;
      case 'cherg':
        ({ products, count } = await fetchCherg({
          query,
          limit,
          page,
        }));
        break;
      case 'schusev':
        ({ products, count } = await fetchSchusev({
          query,
          limit,
          page,
        }));
        break;
      case 'brain':
        ({ products, count } = await fetchBrainProducts({
          query,
          limit: limit,
          page: page,
          categoryId,
        }));
        break;
      default:
        console.warn(`Unknown supplier: ${supplierId}`);
        return reply
          .status(400)
          .send({ error: `Unknown supplier: ${supplierId}` });
    }
    productsWithExistingFlag = await flagExistingShopifyProducts(
      shopify,
      products
    );

    return reply.send({ count, products: productsWithExistingFlag });
  } catch (error) {
    return reply.status(500).send(error);
  }
};

export default route;
