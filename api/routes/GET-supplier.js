import { fetchEasy } from '../utilities/fetchEasy';
import fetchCherg from '../utilities/fetchCherg';
import { getUrlParams } from '../utilities/getUrlParams';
import flagExistingShopifyProducts from '../utilities/flagExistingShopifyProducts';
import getShopifyClient from '../utilities/getShopifyClient';

export default async function route({ request, reply, connections }) {
  try {
    const shopify = getShopifyClient(connections);
    const { query, limit, page, supplierId } = getUrlParams(request);
    console.log('route { supplierId,query, limit, page } ', {
      supplierId,
      query,
      limit,
      page,
    });
    let products, count, productsWithExistingFlag;

    switch (supplierId) {
      case 'easy':
        ({ products, count } = await fetchEasy({
          query,
          limit: +limit,
          page: +page,
        }));

        productsWithExistingFlag = await flagExistingShopifyProducts(
          shopify,
          products
        );

        return reply.send({ count, products: productsWithExistingFlag });
      case 'cherg':
        ({ products, count } = await fetchCherg({
          query,
          limit: +limit,
          page: +page,
        }));

        productsWithExistingFlag = await flagExistingShopifyProducts(
          shopify,
          products
        );

        return reply.send({ count, products: productsWithExistingFlag });
      default:
        return reply.send({ products: [], count: 0 });
    }
  } catch (error) {
    return reply.status(500).send({
      error: 'products fetch failed',
      details: error.message,
    });
  }
}
