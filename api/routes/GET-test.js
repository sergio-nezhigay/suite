import { RouteContext } from 'gadget-server';

/**
 * Route handler for GET test
 *
 * @param { RouteContext } route context - see: https://docs.gadget.dev/guides/http-routes/route-configuration#route-context
 *
 */
export default async function route({
  request,
  reply,
  api,
  logger,
  connections,
}) {
  // Log a simple message to indicate the route was hit
  logger.info('Test route hit successfully');

  logger.info(' currentShopId');
  // Example: Making API call to Shopify
  const shopify = await connections.shopify.forShopId(65276346541);
  logger.info(' shopify', shopify);
  const shopInfo = await shopify.graphql(`
      query {
        shop {
          name
          email
        }
      }
    `);

  // Respond with shop info
  await reply.send(shopInfo);

  // Send a fixed "ok" response
  //  await reply.send({ status: 'ok1' });
}

//const fetchProducts = async () => {
//  // GraphQL query to fetch products
//  const query = `
//    {
//      products(first: 10) {
//        edges {
//          node {
//            id
//            title
//            descriptionHtml
//          }
//        }
//      }
//    }`;

//  try {
//    // Making the fetch request
//    const response = await fetch(
//      'https://your-store.myshopify.com/admin/api/2021-07/graphql.json',
//      {
//        method: 'POST',
//        headers: {
//          'Content-Type': 'application/json',
//          'X-Shopify-Access-Token': 'your-access-token', // Replace with your actual token
//        },
//        body: JSON.stringify({ query }), // Sending the GraphQL query
//      }
//    );

//    // Parsing the response as JSON
//    const result = await response.json();

//    // Returning the result
//    return result;
//  } catch (error) {
//    console.error('Error fetching products:', error);
//    return null;
//  }
//};

//// Example usage of the function
//fetchProducts().then((result) => {
//  if (result) {
//    console.log('Products:', result.data.products.edges);
//  }
//});
