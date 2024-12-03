import {
  getShopifyClient,
  flagExistingShopifyProducts,
  getUrlParams,
  fetchBrain,
  fetchCherg,
  fetchEasy,
} from '../utilities';

export default async function route({ request, reply, connections }) {
  try {
    const shopify = getShopifyClient(connections);
    const {
      query = '',
      limit = 50,
      page = 1,
      supplierId,
    } = getUrlParams(request);
    console.log('route { supplierId,query, limit, page } ', {
      supplierId,
      query,
      limit,
      page,
    });
    let products = [],
      count = 0,
      productsWithExistingFlag;

    switch (supplierId) {
      case 'easy':
        ({ products, count } = await fetchEasy({
          query,
          limit: +limit,
          page: +page,
        }));
        break;
      case 'cherg':
        ({ products, count } = await fetchCherg({
          query,
          limit: +limit,
          page: +page,
        }));
        break;
      case 'brain':
        ({ products, count } = await fetchBrain({
          query,
          limit: +limit,
          page: +page,
        }));
        break;
      default:
    }
    productsWithExistingFlag = await flagExistingShopifyProducts(
      shopify,
      products
    );

    return reply.send({ count, products: productsWithExistingFlag });
  } catch (error) {
    return reply.status(500).send({
      error: 'products fetch failed',
      details: error.message,
    });
  }
}
