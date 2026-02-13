import axios from 'axios';
import { rozetkaTokenManager } from 'api/utilities/rozetka/tokenManager';
import { ROZETKA_API_BASE_URL } from 'api/utilities/data/data';
import { ROZETKA_ORDER_STATUSES } from 'api/utilities/rozetka/rozetkaStatuses';

export const run: ActionRun = async () => {
  console.log('Starting old Rozetka orders check', {
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });

  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    console.warn('Skipping old orders check - not in production environment');
    return;
  }

  try {
    // Get valid access token
    const accessToken = await rozetkaTokenManager.getValidToken();
    if (!accessToken) {
      console.error('Failed to fetch Rozetka access token');
      return;
    }

    // Fetch orders with PLANNED_CALLBACK status
    const orders = await getPlannedCallbackOrders(accessToken);
    if (!orders || orders.length === 0) {
      console.log('No orders with PLANNED_CALLBACK status found');
      return;
    }

    console.log(`Found ${orders.length} orders with PLANNED_CALLBACK status`);

    // Filter and log old orders (6+ days)
    const oldOrders = filterOldOrders(orders, 6);
    
    if (oldOrders.length === 0) {
      console.log('No orders older than 6 days found');
      return;
    }

    console.log(`Found ${oldOrders.length} orders older than 6 days:`);
    
    oldOrders.forEach(order => {
      const ageInDays = calculateAgeInDays(order.created_at);
      console.log({
        orderId: order.id,
        createdAt: order.created_at,
        ageInDays: ageInDays,
        recipientPhone: order.recipient_phone,
      });
    });

    // TODO: Add status update logic here
    // For each old order, update status to 18 (CANCELLED) with comment:
    // await changeRozetkaOrderStatus(order.id, 18, accessToken, 'Не вдалося зв\'язатися');

    console.log('Old orders check completed', {
      totalOrders: orders.length,
      oldOrders: oldOrders.length,
    });

  } catch (error: any) {
    console.error('Old Rozetka orders check failed', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

async function getPlannedCallbackOrders(accessToken: string) {
  const ROZETKA_ORDERS_API_URL = `${ROZETKA_API_BASE_URL}/orders/search`;

  const requestParams = {
    types: ROZETKA_ORDER_STATUSES.PLANNED_CALLBACK,
    expand: 'purchases,delivery',
  };

  console.log('[getPlannedCallbackOrders] Fetching orders with status 47');

  try {
    const response = await axios.get(ROZETKA_ORDERS_API_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      params: requestParams,
    });

    if (response.data.success) {
      console.log(`[getPlannedCallbackOrders] Successfully fetched ${response.data.content.orders.length} orders`);
      return response.data.content.orders;
    } else {
      console.error('[getPlannedCallbackOrders] API returned success=false', {
        responseData: response.data,
      });
      return null;
    }
  } catch (error: any) {
    console.error('[getPlannedCallbackOrders] Request failed', {
      error: error.message,
      responseStatus: error.response?.status,
      responseData: error.response?.data,
    });
    return null;
  }
}

function filterOldOrders(orders: any[], daysThreshold: number) {
  const now = new Date();
  const thresholdDate = new Date(now.getTime() - daysThreshold * 24 * 60 * 60 * 1000);

  return orders.filter(order => {
    const createdAt = new Date(order.created_at);
    return createdAt < thresholdDate;
  });
}

function calculateAgeInDays(createdAt: string): number {
  const now = new Date();
  const created = new Date(createdAt);
  const diffInMs = now.getTime() - created.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  return diffInDays;
}

export const options = {
  triggers: {
    scheduler: [{ cron: '0 10 * * *' }], // Runs daily at 10 AM
  },
};