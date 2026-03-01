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

export const run: ActionRun = async ({ connections }) => {
  // Replace logger.info with console.log
  console.log('Starting Rozetka order processing', {
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });

  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    // Replace logger.warn with console.warn
    console.warn(
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

    // Replace logger.info with console.log
    console.log('Stage 1: Fetch Rozetka access token completed', {
      stage: 'token_fetch',
      duration_ms: tokenEnd - tokenStart,
      success: !!accessTokenRozetka,
    });

    if (!accessTokenRozetka) {
      const error = new Error('Failed to fetch access token');
      // Replace logger.error with console.error
      console.error('Token fetch failed', {
        stage: 'token_fetch',
        error: error.message,
      });
      return;
    }

    // Stage 2: Fetch new orders
    const ordersStart = Date.now();
    const rozOrders = await getNewOrders(accessTokenRozetka);
    const ordersEnd = Date.now();

    // Replace logger.info with console.log
    console.log('Stage 2: Fetch new orders completed', {
      stage: 'fetch_orders',
      duration_ms: ordersEnd - ordersStart,
      orders_count: rozOrders?.length || 0,
    });

    if (!rozOrders || !rozOrders.length) {
      // Replace logger.info with console.log
      console.log('No new orders to process', { stage: 'fetch_orders' });
      return;
    }

    // Stage 3: Process orders
    const processStart = Date.now();
    const shopify = await getShopifyConnection(connections);
    if (!shopify) {
      const error = new Error('No Shopify connection available');
      // Replace logger.error with console.error
      console.error('Shopify connection failed', {
        stage: 'shopify_connection',
        error: error.message,
      });
      return;
    }

    await processOrdersConcurrently(rozOrders, shopify, accessTokenRozetka);
    const processEnd = Date.now();

    // Replace logger.info with console.log
    console.log('Stage 3: Process orders completed', {
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
    // Replace logger.info with console.log
    console.log('Rozetka order processing completed successfully', logData);
    console.log('Additional debug info:', {
      debugData: JSON.stringify(logData),
    });
  } catch (error: any) {
    // Replace logger.error with console.error
    console.error('Rozetka order processing failed', {
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
    await changeRozetkaOrderStatus(
      order.id,
      ROZETKA_ORDER_STATUSES.PROCESSING_BY_SELLER,
      accessToken
    );

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
  accessToken: string,
  isRetry = false
): Promise<RozetkaOrder[] | null> => {
  const ROZETKA_ORDERS_API_URL = `${ROZETKA_API_BASE_URL}/orders/search`;

  const requestParams = {
    types: ROZETKA_ORDER_STATUSES.NEW,
    expand: 'purchases,delivery',
  };

  console.log('[getNewOrders] Making API request', {
    url: ROZETKA_ORDERS_API_URL,
    params: requestParams,
    tokenPreview: `${accessToken.substring(0, 8)}...`,
    tokenLength: accessToken.length,
    isRetry,
  });

  try {
    const response = await axios.get(ROZETKA_ORDERS_API_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      params: requestParams,
    });

    console.log('[getNewOrders] API response received', {
      status: response.status,
      statusText: response.statusText,
      success: response.data?.success,
      hasContent: !!response.data?.content,
      ordersCount: response.data?.content?.orders?.length || 0,
    });

    if (response.data.success) {
      console.log('[getNewOrders] Successfully fetched orders', {
        ordersCount: response.data.content.orders.length,
        orderIds: response.data.content.orders.map((o: any) => o.id),
      });
      return response.data.content.orders;
    } else {
      // Check if this is an invalid token error (error code 1020)
      const errorCode = response.data?.errors?.code;
      const errorMessage = response.data?.errors?.message;

      console.error('[getNewOrders] API returned success=false', {
        responseData: JSON.stringify(response.data, null, 2),
        message: errorMessage || 'No error message provided',
        errorCode: errorCode || 'No error code',
        content: response.data?.content || 'No content',
      });

      // Handle incorrect_access_token error (code 1020)
      if (
        errorCode === 1020 &&
        errorMessage === 'incorrect_access_token' &&
        !isRetry
      ) {
        console.log(
          '[getNewOrders] Detected invalid token error, invalidating cached token and retrying...'
        );

        // Invalidate the cached token
        await rozetkaTokenManager.invalidateToken();
        console.log(
          '[getNewOrders] Token invalidated, fetching fresh token...'
        );

        // Get a fresh token
        const freshToken = await rozetkaTokenManager.getValidToken();
        console.log(
          '[getNewOrders] Fresh token obtained, retrying API request',
          {
            tokenPreview: `${freshToken.substring(0, 8)}...`,
            tokenLength: freshToken.length,
          }
        );

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
    console.error('[getNewOrders] Exception caught', {
      errorMessage: error.message,
      errorName: error.name,
      responseStatus: error.response?.status,
      responseStatusText: error.response?.statusText,
      responseData: error.response?.data
        ? JSON.stringify(error.response.data, null, 2)
        : 'No response data',
      requestUrl: error.config?.url,
      requestParams: error.config?.params,
    });
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
    const { barcode, cost, handle, alternativeTitle, sku } =
      await getPropertiesFromOfferId(purchase.item.price_offer_id, shopify);

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
        {
          name: '_product_handle',
          value: handle,
        },
        { name: '_sku', value: sku },
        { name: '_alternative_title', value: alternativeTitle },
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

  console.error(
    `[${context}] Detailed error information:`,
    JSON.stringify(errorDetails, null, 2)
  );

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

interface Properties {
  barcode: string;
  cost: string;
  handle: string;
  sku: string;
  alternativeTitle: string;
}

export const getPropertiesByProductId = async (
  productId: string,
  shopify: Shopify
): Promise<Properties> => {
  if (!productId) {
    console.warn(`[fetchBarcodeByProductId] No productId provided`);
    return { barcode: '', cost: '', handle: '', sku: '', alternativeTitle: '' };
  }

  console.log(
    `[fetchBarcodeByProductId] Fetching barcode and metafield for product ID: ${productId}`
  );
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
      console.log(`[fetchBarcodeByProductId] Found data`, {
        barcode,
        handle,
        alternativeTitle,
      });
    } else {
      console.warn(
        `[fetchBarcodeByProductId] No barcode/metafield found for product ID: ${productId}`
      );
    }

    return { barcode, cost, handle, sku, alternativeTitle };
  } catch (error) {
    console.error(
      `[fetchBarcodeByProductId] Error fetching product data:`,
      error
    );
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
