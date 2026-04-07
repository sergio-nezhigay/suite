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
    if (!rozOrders || !rozOrders.length) {
      // Replace logger.info with console.log
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
    const endTime = Date.now();
    const logData = {
      total_duration_ms: endTime - startTime,
      orders_processed: rozOrders.length,
      stages_completed: 3,
    };
    // Replace logger.info with console.log
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
    const orderVariables = await transformOrderToShopifyVariables(
      order,
      shopify
    );
    const shopifyOrder = await createOrder({
      shopify,
      variables: orderVariables,
    });
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
  shopify: Shopify
): Promise<string | null> => {
  if (!offerId) {
    console.warn(`[fetchProductIdByOfferId] No offerId provided`);
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
