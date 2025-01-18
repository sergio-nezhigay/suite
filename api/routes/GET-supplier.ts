import { RouteHandler } from 'gadget-server';
import { connections } from 'gadget-server';

import {
  getShopifyClient,
  flagExistingShopifyProducts,
  getUrlParams,
  fetchBrainProducts,
  fetchCherg,
  fetchSchusev,
  fetchEasy,
} from '@/utilities/';

const route: RouteHandler<{
  Querystring: {
    query: string | undefined;
    limit?: string | undefined;
    page?: string | undefined;
    supplierId?: string | undefined;
    categoryId?: string | undefined;
  };
}> = async ({ request, reply }) => {
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
