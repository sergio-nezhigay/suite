import axios from 'axios';

import { createOrder } from 'utilities/createOrder';
import { getShopifyConnection } from 'utilities/getShopifyConnection';

const ORDER_STATUS_CODES = {
  ALL: '1',
  PROCESSING: '2',
  COMPLETED: '3',
  NEW: '4',
  SHIPPING: '5',
};

const ROZETKA_API_BASE_URL = 'https://api-seller.rozetka.com.ua';

let accessToken: string | null = null;

export const run: ActionRun = async ({ connections }) => {
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) return;
  accessToken = await fetchAccessToken();
  if (!accessToken) {
    return handleError(new Error('Failed to fetch access token'), 'run');
  }

  const newOrders = await getNewOrders(accessToken);
  if (!newOrders) {
    console.log('No new orders. run finished');
    return;
  }

  const shopify = await getShopifyConnection(connections);
  if (!shopify) {
    return handleError(new Error('No Shopify connection available'), 'run');
  }

  for (const order of newOrders) {
    const variables = mapOrderToVariables(order);

    try {
      const createdOrder = await createOrder({ shopify, variables });
      console.log(`Order ${order.id} created successfully`, createdOrder);

      const isStatusUpdated = await updateRozetkaStatus(
        order.id,
        26, //  "Обрабатывается менеджером",
        accessToken
      );
      if (isStatusUpdated) {
        console.log(`[Rozetka] Status for order ${order.id} changed`);
      } else {
        console.error(
          `[Rozetka] Failed to update status for order ${order.id}`
        );
      }
    } catch (error) {
      handleError(error, `run - Order ${order.id}`);
    }
  }
};

const updateRozetkaStatus = async (
  orderId: number,
  status: number,
  accessToken: string
) => {
  try {
    const response = await axios.put(
      `${ROZETKA_API_BASE_URL}/orders/${orderId}`,
      { status },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.success) {
      console.log(`Status updated to ${status} for Rozetka order ${orderId}`);
      return true;
    } else {
      console.log(`response.data- ${JSON.stringify(response.data)}`);
      return handleError(
        new Error('Failed to update status'),
        'updateRozetkaStatus'
      );
    }
  } catch (error) {
    return handleError(error, 'updateRozetkaStatus');
  }
};

export const getNewOrders = async (accessToken: string) => {
  const ROZETKA_ORDERS_API_URL = `${ROZETKA_API_BASE_URL}/orders/search`;

  try {
    const response = await axios.get(ROZETKA_ORDERS_API_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      params: {
        types: ORDER_STATUS_CODES.NEW,
        expand: 'purchases,delivery',
      },
    });

    if (response.data.success) {
      return response.data.content.orders;
    } else {
      return handleError(
        new Error('Failed to get access orders'),
        'getNewOrders'
      );
    }
  } catch (error) {
    return handleError(error, 'getNewOrders');
  }
};

const mapOrderToVariables = (order: any) => {
  const lineItems =
    order?.purchases && order.purchases.length > 0
      ? order.purchases.map(
          (purchase: {
            item_name: string;
            quantity: string;
            price_with_discount: string;
            price: string;
          }) => ({
            title: purchase.item_name,
            quantity: purchase.quantity,
            priceSet: {
              shopMoney: {
                amount: purchase.price_with_discount || purchase.price,
                currencyCode: 'UAH',
              },
            },
          })
        )
      : [];
  return {
    order: {
      name: `${order.id}`,
      email: `${order.recipient_phone}@example.com`,
      shippingAddress: {
        address1: order?.delivery?.place_number || 'адреса невідома',
        firstName: order.recipient_title.first_name,
        lastName: order.recipient_title.last_name,
        city: order.delivery.city.name_ua || 'невідоме місто',
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
          status: 'SUCCESS',
        },
      ],
      lineItems,
    },
  };
};

const fetchAccessToken = async (): Promise<string | null> => {
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
      return handleError(
        new Error('Failed to get access token' + (response.data.message || '')),
        'fetchAccessToken'
      );
    }
  } catch (error: any) {
    return handleError(error, 'fetchAccessToken');
  }
};

const handleError = (error: any, context: string) => {
  const message = error?.response?.data || error?.message || 'Unknown error';
  console.error(`[${context}] Error: ${message}`);
  return null;
};

export const options = {
  triggers: {
    scheduler: [{ every: 'hour', at: '0 mins' }],
  },
};
