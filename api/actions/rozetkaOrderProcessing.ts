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
import { ROZETKA_ORDER_STATUSES } from 'api/utilities/rozetka/rozetkaStatuses';
import { timeIt } from 'api/utilities/timeIt';

export const run: ActionRun = async ({ connections, logger }) => {
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    logger.warn({ }, 'Skipping Rozetka order processing - not in production environment');
    return;
  }

  const startTime = Date.now();

  // Stage 1: Fetch Rozetka access token
  const tokenStart = Date.now();
  try {
    const accessTokenRozetka = await rozetkaTokenManager.getValidToken();
    const tokenEnd = Date.now();
    logger.info({ duration_ms: tokenEnd - tokenStart }, 'Stage 1: access token fetched');

    if (!accessTokenRozetka) {
      const error = new Error('Failed to fetch access token');
      logger.error({
        stage: 'token_fetch',
        error: error.message,
      }, 'Token fetch failed');
      return;
    }

    // Stage 2: Fetch new orders
    const ordersStart = Date.now();
    const rozOrders = await getNewOrders(accessTokenRozetka);
    const ordersEnd = Date.now();
    logger.info({ duration_ms: ordersEnd - ordersStart, count: rozOrders?.length ?? 0 }, 'Stage 2: orders fetched');

    if (!rozOrders || !rozOrders.length) {
      logger.info({ }, 'No new Rozetka orders to process');
      return;
    }

    // Stage 3: Process orders
    const processStart = Date.now();
    const shopify = await getShopifyConnection(connections);
    if (!shopify) {
      const error = new Error('No Shopify connection available');
      logger.error({
        stage: 'shopify_connection',
        error: error.message,
      }, 'Shopify connection failed');
      return;
    }

    await timeIt(
      'all_orders_processing',
      () => processOrdersConcurrently(rozOrders, shopify, accessTokenRozetka, logger),
      logger,
      { order_count: rozOrders.length }
    );
    const processEnd = Date.now();

    const endTime = Date.now();
    logger.info({
      total_duration_ms: endTime - startTime,
      orders_processed: rozOrders.length,
      stages_completed: 3,
    }, 'Rozetka order processing completed');
  } catch (error: any) {
    logger.error({
      error: error.message,
      stack: error.stack,
      duration_ms: Date.now() - startTime,
    }, 'Rozetka order processing failed');
    throw error;
  }
};

const CONCURRENCY_LIMIT = 3;

async function processOrdersConcurrently(
  orders: RozetkaOrder[],
  shopify: Shopify,
  accessToken: string,
  logger: any
) {
  // Split orders into chunks to control concurrency
  const chunks = [];
  for (let i = 0; i < orders.length; i += CONCURRENCY_LIMIT) {
    chunks.push(orders.slice(i, i + CONCURRENCY_LIMIT));
  }

  const batchStart = performance.now();

  // Process each chunk concurrently
  for (const chunk of chunks) {
    const results = await Promise.allSettled(
      chunk.map((order) =>
        timeIt('single_order', () => processOrder(order, shopify, accessToken, logger), logger, { orderId: order.id })
      )
    );

    // Log results for each chunk
    results.forEach((result, index) => {
      const order = chunk[index];
      if (result.status === 'fulfilled') {
      } else {
        logger.error({ orderId: order.id, err: result.reason }, 'Order processing failed');
      }
    });
  }

  const batchEnd = performance.now();
  logger.info({
    stage: 'batch_summary',
    total_orders: orders.length,
    total_duration_ms: Math.round(batchEnd - batchStart),
    avg_ms_per_order: orders.length > 0 ? Math.round((batchEnd - batchStart) / orders.length) : 0,
  }, 'Batch processing summary');
}

async function processOrder(
  order: RozetkaOrder,
  shopify: Shopify,
  accessToken: string,
  logger: any
) {
  try {
    const customer = await timeIt('find_or_create_customer',
      () => findOrCreateShopifyCustomer(shopify, order), logger, { orderId: order.id });
    const orderVariables = await timeIt('transform_order',
      () => transformOrderToShopifyVariables(order, shopify), logger, { orderId: order.id });
    const shopifyOrder = await timeIt('shopify_create_order',
      () => createOrder({ shopify, variables: orderVariables }), logger, { orderId: order.id });
    await timeIt('rozetka_status_update',
      () => changeRozetkaOrderStatus(order.id, ROZETKA_ORDER_STATUSES.PROCESSING_BY_SELLER, accessToken),
      logger, { orderId: order.id });

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
    // Disabled to save CPU time by avoiding the Shopify customer search.
    // const foundCustomer = await findCustomer({
    //   shopify,
    //   phone: order.recipient_phone,
    // });
    //
    // if (foundCustomer) {
    //   return foundCustomer;
    // }

    const customerVariables = transformOrderToCustomerVariables(order);
    const createdCustomer = await createCustomer({
      shopify,
      variables: customerVariables,
    });
    return createdCustomer;
  } catch (error) {
    throw new Error(`Failed to get/create customer: ${error}`);
  }
}

export const getNewOrders = async (
  accessToken: string,
  isRetry = false
): Promise<RozetkaOrder[] | null> => {
  const ROZETKA_ORDERS_API_URL = `${ROZETKA_API_BASE_URL}/orders/search`;

  const requestParams = {
    types: ROZETKA_ORDER_STATUSES.NEW,
    expand: 'purchases,delivery',
  };
  try {
    const response = await axios.get(ROZETKA_ORDERS_API_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      params: requestParams,
    });
    if (response.data.success) {
      return response.data.content.orders;
    } else {
      // Check if this is an invalid token error (error code 1020)
      const errorCode = response.data?.errors?.code;
      const errorMessage = response.data?.errors?.message;
      // Handle incorrect_access_token error (code 1020)
      if (
        errorCode === 1020 &&
        errorMessage === 'incorrect_access_token' &&
        !isRetry
      ) {
        // Invalidate the cached token
        await rozetkaTokenManager.invalidateToken();
        // Get a fresh token
        const freshToken = await rozetkaTokenManager.getValidToken();
        // Retry with the fresh token (pass isRetry=true to prevent infinite loop)
        return getNewOrders(freshToken, true);
      }

      return logAndReturnError(
        new Error(
          `Failed to get access orders: ${
            errorMessage || 'Unknown error'
          } (code: ${errorCode})`
        ),
        'getNewOrders'
      );
    }
  } catch (error: any) {
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
    // Disabled to save CPU time by avoiding extra Shopify GraphQL lookups per line item.
    // const { barcode, cost, handle, alternativeTitle, sku } =
    //   await getPropertiesFromOfferId(purchase.item.price_offer_id, shopify);

    return {
      title: purchase.item_name,
      quantity: purchase.quantity,
      priceSet: {
        shopMoney: {
          amount: purchase.price_with_discount || purchase.price,
          currencyCode: 'UAH',
        },
      },
      properties: [],
      // properties: [
      //   { name: '_barcode', value: barcode },
      //   { name: '_cost', value: cost },
      //   { name: '_product_handle', value: handle },
      //   { name: '_sku', value: sku },
      //   { name: '_alternative_title', value: alternativeTitle },
      // ],
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

  // Extract all relevant error information
  const errorDetails = {
    context,
    message: err?.message || 'Unknown error',
    errorName: err?.name,
    httpStatus: err?.response?.status,
    httpStatusText: err?.response?.statusText,
    responseData: err?.response?.data,
    requestUrl: err?.config?.url,
    requestMethod: err?.config?.method,
    requestHeaders: err?.config?.headers
      ? {
          ...err.config.headers,
          Authorization: err.config.headers.Authorization
            ? '[REDACTED]'
            : undefined,
        }
      : undefined,
    stack: err?.stack,
  };
  return null;
};

export const options = {
  triggers: {
    scheduler: [
      { cron: '0 7,9,11,13,14 * * 1-5' }, // Weekdays: 10:00 12:00 14:00 16:00 17:00 Kyiv
      { cron: '0 7,10 * * 6' }, // Saturday: 10:00 and 13:00 Kyiv only
      // Sunday: off
    ],
  },
};


export const getShopifyProductIdByOfferId = async (
  offerId: string,
  shopify: Shopify,
  logger?: any
): Promise<string | null> => {
  if (!offerId) {
    logger?.warn({ }, '[fetchProductIdByOfferId] No offerId provided');
    return null;
  }

  if (offerId.includes('gid://shopify/Product/')) {
    return offerId;
  }
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
    } else {
      logger?.warn({ offerId }, '[fetchProductIdByOfferId] No product found for offerId');
    }

    return productId;
  } catch (error) {
    logger?.error({ err: error }, '[fetchProductIdByOfferId] Error fetching product ID');
    return null;
  }
};

interface Properties {
  barcode: string;
  cost: string;
  handle: string;
  sku: string;
  alternativeTitle: string;
}

export const getPropertiesByProductId = async (
  productId: string,
  shopify: Shopify,
  logger?: any
): Promise<Properties> => {
  if (!productId) {
    logger?.warn({ }, '[fetchBarcodeByProductId] No productId provided');
    return { barcode: '', cost: '', handle: '', sku: '', alternativeTitle: '' };
  }
  const query = `
        query getProductBarcodeAndMetafield($id: ID!) {
          product(id: $id) {
            handle
            metafield(namespace: "custom", key: "alternative_title") {
              value
            }
            variants(first: 1) {
              edges {
                node {
                  sku
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
    const variantNode = response?.product?.variants?.edges?.[0]?.node;
    const barcode = variantNode?.barcode || '';
    const sku = variantNode?.sku || '';
    const cost = variantNode?.inventoryItem?.unitCost?.amount
      ? String(variantNode.inventoryItem.unitCost.amount)
      : '';
    const handle = response?.product?.handle || '';
    const alternativeTitle = response?.product?.metafield?.value || '';

    if (barcode || alternativeTitle) {
    } else {
      logger?.warn({ productId }, '[fetchBarcodeByProductId] No barcode/metafield found for product ID');
    }

    return { barcode, cost, handle, sku, alternativeTitle };
  } catch (error) {
    logger?.error({ err: error }, '[fetchBarcodeByProductId] Error fetching product data');
    return { barcode: '', cost: '', handle: '', sku: '', alternativeTitle: '' };
  }
};

export const getPropertiesFromOfferId = async (
  offerId: string,
  shopify: Shopify
): Promise<Properties> => {
  const productId = await getShopifyProductIdByOfferId(offerId, shopify);
  if (!productId)
    return { barcode: '', cost: '', handle: '', sku: '', alternativeTitle: '' };

  return getPropertiesByProductId(productId, shopify);
};
