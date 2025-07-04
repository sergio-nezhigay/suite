import { RouteHandler } from 'gadget-server';

import {
  getShopifyClient,
  fetchEasy,
  fetchSchusev,
  fetchBrainProducts,
  flagExistingShopifyProducts,
  getUrlParams,
  fetchFromSheet,
} from 'utilities';

const route: RouteHandler<{
  Querystring: {
    query?: string;
    limit?: string;
    page?: string;
    supplierId?: string;
    categoryId?: string;
  };
}> = async ({ request, reply, connections }) => {
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
        ({ products, count } = await fetchFromSheet({
          query,
          limit,
          page,
          sheetId: process.env.CHERG_PRICE_ID || '',
          tabId: 35957627,
        }));
        break;
      case 'universal':
        ({ products, count } = await fetchFromSheet({
          query,
          limit,
          page,
          sheetId: '1FIRJvHmopU_5C5oRx78ZrxUqZiYlPjbXY4dz0aumOjM',
          tabId: 0,
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
