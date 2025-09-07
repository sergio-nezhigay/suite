import axios from 'axios';
import Shopify from 'shopify-api-node';

import { getShopifyConnection, createOrder } from 'utilities';
import {
  createCustomer,
  findCustomer,
} from '../utilities/shopify/api/orders/createCustomer';
import { RozetkaOrder, ShopifyOrder } from 'types/*';

import { changeRozetkaOrderStatus } from 'api/utilities/rozetka/changeRozetkaOrderStatus';
import { ROZETKA_API_BASE_URL } from 'api/utilities/data/data';
import { rozetkaTokenManager } from 'api/utilities/rozetka/tokenManager';

const ORDER_STATUS_CODES = {
  ALL: '1',
  PROCESSING: '2',
  COMPLETED: '3',
  NEW: '4',
  SHIPPING: '5',
};

export const run: ActionRun = async ({ connections, logger }) => {
  // Add logger to the context parameters
  logger.info('Starting Rozetka order processing', {
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });

  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    logger.warn(
      'Skipping Rozetka order processing - not in production environment'
    );
    return;
  }

  const startTime = Date.now();

  // Stage 1: Fetch Rozetka access token
  const tokenStart = Date.now();
  try {
    const accessTokenRozetka = await rozetkaTokenManager.getValidToken();
    const tokenEnd = Date.now();

    logger.info('Stage 1: Fetch Rozetka access token completed', {
      stage: 'token_fetch',
      duration_ms: tokenEnd - tokenStart,
      success: !!accessTokenRozetka,
    });

    if (!accessTokenRozetka) {
      const error = new Error('Failed to fetch access token');
      logger.error('Token fetch failed', {
        stage: 'token_fetch',
        error: error.message,
      });
      return;
    }

    // Stage 2: Fetch new orders
    const ordersStart = Date.now();
    const rozOrders = await getNewOrders(accessTokenRozetka);
    const ordersEnd = Date.now();

    logger.info('Stage 2: Fetch new orders completed', {
      stage: 'fetch_orders',
      duration_ms: ordersEnd - ordersStart,
      orders_count: rozOrders?.length || 0,
    });

    if (!rozOrders || !rozOrders.length) {
      logger.info('No new orders to process', { stage: 'fetch_orders' });
      return;
    }

    // Stage 3: Process orders
    const processStart = Date.now();
    const shopify = await getShopifyConnection(connections);
    if (!shopify) {
      const error = new Error('No Shopify connection available');
      logger.error('Shopify connection failed', {
        stage: 'shopify_connection',
        error: error.message,
      });
      return;
    }

    await processOrdersConcurrently(rozOrders, shopify, accessTokenRozetka);
    const processEnd = Date.now();

    logger.info('Stage 3: Process orders completed', {
      stage: 'process_orders',
      duration_ms: processEnd - processStart,
      total_orders: rozOrders.length,
    });

    const endTime = Date.now();
    const logData = {
      total_duration_ms: endTime - startTime,
      orders_processed: rozOrders.length,
      stages_completed: 3,
    };
    logger.info('Rozetka order processing completed successfully', logData);
    logger.info('Additional debug info:', {
      debugData: JSON.stringify(logData),
    });
  } catch (error: any) {
    logger.error('Rozetka order processing failed', {
      error: error.message,
      stack: error.stack,
      duration_ms: Date.now() - startTime,
    });
    throw error;
  }
};

const CONCURRENCY_LIMIT = 3;

async function processOrdersConcurrently(
  orders: RozetkaOrder[],
  shopify: Shopify,
  accessToken: string
) {
  // Split orders into chunks to control concurrency
  const chunks = [];
  for (let i = 0; i < orders.length; i += CONCURRENCY_LIMIT) {
    chunks.push(orders.slice(i, i + CONCURRENCY_LIMIT));
  }

  // Process each chunk concurrently
  for (const chunk of chunks) {
    const results = await Promise.allSettled(
      chunk.map((order) => processOrder(order, shopify, accessToken))
    );

    // Log results for each chunk
    results.forEach((result, index) => {
      const order = chunk[index];
      if (result.status === 'fulfilled') {
        console.log(`Order ${order.id} processed successfully`);
      } else {
        console.error(`Order ${order.id} failed:`, result.reason);
      }
    });
  }
}

async function processOrder(
  order: RozetkaOrder,
  shopify: Shopify,
  accessToken: string
) {
  try {
    const customer = await findOrCreateShopifyCustomer(shopify, order);
    console.log(`Customer ready for order ${order.id}`, customer);

    const orderVariables = await transformOrderToShopifyVariables(
      order,
      shopify
    );
    const shopifyOrder = await createOrder({
      shopify,
      variables: orderVariables,
    });

    console.log(`Order ${order.id} created successfully`, shopifyOrder);
    await changeRozetkaOrderStatus(order.id, 26, accessToken);

    return { success: true, orderId: order.id };
  } catch (error) {
    // Don't use logAndReturnError here since we want to throw for Promise.allSettled
    throw new Error(`Order ${order.id} processing failed: ${error}`);
  }
}
async function findOrCreateShopifyCustomer(
  shopify: Shopify,
  order: RozetkaOrder
) {
  try {
    const foundCustomer = await findCustomer({
      shopify,
      phone: order.recipient_phone,
    });

    if (foundCustomer) {
      console.log('Found existing customer:', foundCustomer);
      return foundCustomer;
    }

    const customerVariables = transformOrderToCustomerVariables(order);
    const createdCustomer = await createCustomer({
      shopify,
      variables: customerVariables,
    });
    console.log('Created new customer:', createdCustomer);
    return createdCustomer;
  } catch (error) {
    throw new Error(`Failed to get/create customer: ${error}`);
  }
}

export const getNewOrders = async (
  accessToken: string
): Promise<RozetkaOrder[] | null> => {
  const ROZETKA_ORDERS_API_URL = `${ROZETKA_API_BASE_URL}/orders/search`;

  try {
    const response = await axios.get(ROZETKA_ORDERS_API_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      params: {
        //types: ORDER_STATUS_CODES.ALL,
        types: ORDER_STATUS_CODES.NEW,
        expand: 'purchases,delivery',
      },
    });

    if (response.data.success) {
      return response.data.content.orders;
    } else {
      return logAndReturnError(
        new Error('Failed to get access orders'),
        'getNewOrders'
      );
    }
  } catch (error) {
    return logAndReturnError(error, 'getNewOrders');
  }
};

const transformOrderToCustomerVariables = (order: RozetkaOrder) => {
  return {
    input: {
      firstName: order.recipient_title.first_name,
      lastName: order.recipient_title.last_name,
      email: `${order.recipient_phone}@example.com`,
      phone: order.recipient_phone,
    },
  };
};

const transformOrderToShopifyVariables = async (
  order: RozetkaOrder,
  shopify: Shopify
): Promise<{ order: ShopifyOrder }> => {
  if (!order) throw new Error('Order is required');

  const mapPurchaseToLineItem = async (purchase: any) => {
    const { barcode, cost } = await getBarcodeAndCostFromOfferId(
      purchase.item.price_offer_id,
      shopify
    );

    return {
      title: purchase.item_name,
      quantity: purchase.quantity,
      priceSet: {
        shopMoney: {
          amount: purchase.price_with_discount || purchase.price,
          currencyCode: 'UAH',
        },
      },
      properties: [
        {
          name: '_barcode',
          value: barcode,
        },
        {
          name: '_cost',
          value: cost,
        },
      ],
    };
  };

  const lineItems = order.purchases?.length
    ? await Promise.all(order.purchases.map(mapPurchaseToLineItem))
    : [];

  return {
    order: {
      name: `№${order.id}`,
      email: `${order.recipient_phone}@example.com`,
      //  financialStatus: 'PENDING',
      shippingAddress: {
        address1: order.delivery?.place_number || 'адреса невідома',
        firstName: order.recipient_title?.first_name || "Невідоме ім'я",
        lastName: order.recipient_title?.last_name || 'Невідоме прізвище',
        city: order.delivery?.city?.title || 'невідоме місто',
        zip: '12345',
        countryCode: 'UA',
        phone: order.recipient_phone,
      },
      transactions: [
        {
          gateway: 'Накладений платіж',
          amountSet: {
            shopMoney: {
              currencyCode: 'UAH',
              amount: order.amount_with_discount || order.amount,
            },
          },
          kind: 'SALE',
          status: 'PENDING',
        },
      ],
      lineItems,
      sourceIdentifier: `rozetka-order-${order.id}`,
      sourceName: 'Rozetka Marketplace',
      sourceUrl: `https://seller.rozetka.com.ua/main/orders/all/845014259${order.id}`,
    },
  };
};

const getRozetkaAccessToken = async (): Promise<string | null> => {
  try {
    const response = await axios.post(
      `${ROZETKA_API_BASE_URL}/sites`,
      {
        username: process.env.ROZETKA_USERNAME,
        password: process.env.ROZETKA_PASSWORD_BASE64,
      },
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (response.data.success) {
      return response.data.content.access_token;
    } else {
      return logAndReturnError(
        new Error('Failed to get access token' + (response.data.message || '')),
        'fetchAccessToken'
      );
    }
  } catch (error: any) {
    return logAndReturnError(error, 'fetchAccessToken');
  }
};

const logAndReturnError = (error: unknown, context: string): null => {
  const err = error as any;
  const message = err?.response?.data || err?.message || 'Unknown error';
  console.error(`[${context}] Error: ${message}`);
  return null;
};

export const options = {
  triggers: {
    scheduler: [{ cron: '0 6-15 * * *' }],
  },
};

export const getShopifyProductIdByOfferId = async (
  offerId: string,
  shopify: Shopify
): Promise<string | null> => {
  if (!offerId) {
    console.warn(`[fetchProductIdByOfferId] No offerId provided`);
    return null;
  }

  if (offerId.includes('gid://shopify/Product/')) {
    console.log(
      `[fetchProductIdByOfferId] offerId is already a Shopify GID: ${offerId}`
    );
    return offerId;
  }

  console.log(`[fetchProductIdByOfferId] Searching for product ID...`);

  const query = `
        query getProducts($query: String!) {
          products(first: 1, query: $query) {
            edges {
              node {
                id
              }
            }
          }
        }
      `;

  const variables = {
    query: `metafields.custom.id-woocommerce:\"${offerId}\"`,
  };

  try {
    const response = await shopify.graphql(query, variables);
    const productId = response?.products?.edges?.[0]?.node?.id || null;

    if (productId) {
      console.log(
        `[fetchProductIdByOfferId] Found Shopify product ID: ${productId}`
      );
    } else {
      console.warn(
        `[fetchProductIdByOfferId] No product found for offerId: ${offerId}`
      );
    }

    return productId;
  } catch (error) {
    console.error(
      `[fetchProductIdByOfferId] Error fetching product ID:`,
      error
    );
    return null;
  }
};

interface BarcodeCost {
  barcode: string;
  cost: string;
}

export const getBarcodeAndCostByProductId = async (
  productId: string,
  shopify: Shopify
): Promise<BarcodeCost> => {
  if (!productId) {
    console.warn(`[fetchBarcodeByProductId] No productId provided`);
    return { barcode: '', cost: '' };
  }

  console.log(
    `[fetchBarcodeByProductId] Fetching barcode for product ID: ${productId}`
  );
  // need to return alson "cost" field
  const query = `
        query getProductBarcode($id: ID!) {
          product(id: $id) {
            variants(first: 1) {
              edges {
                node {
                  barcode
                  inventoryItem {
                      unitCost {
                        amount
                        currencyCode
                      }
                  }
                }
              }
            }
          }
        }
      `;

  try {
    const response = await shopify.graphql(query, { id: productId });
    const barcode =
      response?.product?.variants?.edges?.[0]?.node?.barcode || '';
    const cost =
      response?.product?.variants?.edges?.[0]?.node?.inventoryItem?.unitCost
        ?.amount || 0;

    if (barcode) {
      console.log(`[fetchBarcodeByProductId] Found barcode: ${barcode}`);
    } else {
      console.warn(
        `[fetchBarcodeByProductId] No barcode found for product ID: ${productId}`
      );
    }

    return { barcode, cost };
  } catch (error) {
    console.error(`[fetchBarcodeByProductId] Error fetching barcode:`, error);
    return { barcode: '', cost: '' };
  }
};

export const getBarcodeAndCostFromOfferId = async (
  offerId: string,
  shopify: Shopify
): Promise<BarcodeCost> => {
  const productId = await getShopifyProductIdByOfferId(offerId, shopify);
  if (!productId) return { barcode: '', cost: '' };

  return getBarcodeAndCostByProductId(productId, shopify);
};
