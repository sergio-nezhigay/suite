import {
  getShopifyClient,
  flagExistingShopifyProducts,
  getUrlParams,
  fetchBrainProducts,
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
      case 'brain':
        ({ products, count } = await fetchBrainProducts({
          query,
          limit: limit,
          page: page,
          categoryId,
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
    return reply.status(500).send(error);
  }
}
