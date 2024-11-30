//import { fetchEasy } from '../utilities/fetchEasy';
//import { getUrlParams } from '../utilities/getUrlParams';
//import flagExistingShopifyProducts from '../utilities/flagExistingShopifyProducts';
//import getShopifyClient from '../utilities/getShopifyClient';

//export default async function route({ request, reply, connections }) {
//  try {
//    const shopify = getShopifyClient(connections);
//    const { query, limit, page } = getUrlParams(request);
//    console.log('route { query, limit, page } ', { query, limit, page });
//    const data = await fetchEasy({
//      query,
//      limit: +limit,
//      page: +page,
//    });

//    const productsWithField = await flagExistingShopifyProducts(
//      shopify,
//      data.products
//    );

//    return reply.send({ ...data, products: productsWithField });
//  } catch (error) {
//    return reply.status(500).send({
//      error: 'products fetch failed',
//      details: error.message,
//    });
//  }
//}
