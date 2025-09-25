import { fetchNovaPoshtaDeclaration } from '../utilities/fetchDeclarationFromSheet';

export const run = async ({ api, connections, config }: any) => {
  // Only run in production environment
  if (process.env.NODE_ENV !== 'production') {
    console.log(
      'Skipping declaration orders processing - not in production environment'
    );
    return;
  }

  console.log('Starting declaration orders processing');

  try {
    // Find unfulfilled orders with "Декларації" tag
    const orders = await api.shopifyOrder.findMany({
      filter: {
        fulfillmentStatus: { notEquals: 'fulfilled' },
        tags: { matches: 'Декларації' },
      },
      select: {
        id: true,
        name: true,
        fulfillmentStatus: true,
        tags: true,
        shopId: true,
      },
    });

    console.log(`Found ${orders.length} declaration orders`);

    // Process each order
    for (const order of orders) {
      console.log(`Processing order: ${order.name} (${order.id})`);

      try {
        if (!order.name) {
          console.warn(`Order ${order.id} has no name, skipping`);
          continue;
        }

        const novaPoshtaDeclaration = await fetchNovaPoshtaDeclaration(
          order.name,
          config
        );
        console.log(
          'novaPoshtaDeclaration',
          JSON.stringify(novaPoshtaDeclaration, null, 2)
        );

if (novaPoshtaDeclaration) {
  console.log(`Found declaration for order ${order.name}: ${novaPoshtaDeclaration}`);
  
  try {
    // Step 1: Get fulfillment orders
    const shopifyClient = await connections.shopify.forShopId(order.shopId);
    const fulfillmentOrdersResponse = await shopifyClient.graphql(`
      query GetOrderFulfillmentOrders($orderId: ID!) {
        order(id: $orderId) {
          id
          name
          fulfillmentOrders(first: 10) {
            edges {
              node {
                id
                status
              }
            }
          }
        }
      }
    `, {
      orderId: `gid://shopify/Order/${order.id}`
    });

    const fulfillmentOrders = fulfillmentOrdersResponse.order?.fulfillmentOrders?.edges || [];
    
    if (fulfillmentOrders.length === 0) {
      console.warn(`No fulfillment orders found for order ${order.name}`);
      continue;
    }

    // Step 2: Create fulfillment for each fulfillment order
    for (const fulfillmentOrderEdge of fulfillmentOrders) {
      const fulfillmentOrderId = fulfillmentOrderEdge.node.id;
      
      const fulfillmentResponse = await shopifyClient.graphql(`
        mutation FulfillOrder($fulfillment: FulfillmentInput!, $message: String) {
          fulfillmentCreate(
            fulfillment: $fulfillment
            message: $message
          ) {
            fulfillment {
              id
              status
              createdAt
              totalQuantity
              trackingInfo {
                number
                url
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `, {
        fulfillment: {
          trackingInfo: {
            number: novaPoshtaDeclaration,
            url: `https://novaposhta.ua/tracking/?cargo_number=${novaPoshtaDeclaration}`,
            company: "Nova Poshta"
          },
          lineItemsByFulfillmentOrder: [
            {
              fulfillmentOrderId: fulfillmentOrderId
            }
          ]
        },
        message: "Order fulfilled via Nova Poshta declaration processing"
      });

      if (fulfillmentResponse.fulfillmentCreate.userErrors?.length > 0) {
        console.error(`Fulfillment creation errors for order ${order.name}:`, fulfillmentResponse.fulfillmentCreate.userErrors);
      } else {
        console.log(`Successfully created fulfillment for order ${order.name} with tracking ${novaPoshtaDeclaration}`);
      }
    }
  } catch (fulfillmentError) {
    console.error(`Error creating fulfillment for order ${order.name}:`, fulfillmentError);
  }
} else {
  console.warn(`No declaration found for order ${order.name}`);
}
      } catch (error) {
        console.error(`Error processing order ${order.name}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in processDeclarationOrders:', error);
  }
};

export const options = {
  triggers: {
    scheduler: [{ cron: '0 */12 * * *' }],
  },
};
