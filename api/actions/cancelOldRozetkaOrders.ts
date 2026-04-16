import axios from 'axios';
import { rozetkaTokenManager } from 'api/utilities/rozetka/tokenManager';
import { ROZETKA_API_BASE_URL } from 'api/utilities/data/data';
import { ROZETKA_ORDER_STATUSES } from 'api/utilities/rozetka/rozetkaStatuses';
import { changeRozetkaOrderStatus } from 'api/utilities/rozetka/changeRozetkaOrderStatus';

// Helper function to robustly parse Rozetka dates
function parseRozetkaDate(dateStr: string): Date {
  if (!dateStr) return new Date('Invalid');

  // Try standard parsing first
  let date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
      return date;
  }

  // Handle "YYYY-MM-DD HH:mm:ss" format
  const sqlFormat = /^(\d{4})-(\d{2})-(\d{2})\s(\d{2}):(\d{2}):(\d{2})$/;
  const sqlMatch = dateStr.match(sqlFormat);
  if (sqlMatch) {
      const isoStr = `${sqlMatch[1]}-${sqlMatch[2]}-${sqlMatch[3]}T${sqlMatch[4]}:${sqlMatch[5]}:${sqlMatch[6]}`;
      return new Date(isoStr);
  }

  // Handle "DD.MM.YYYY" format
  const dotFormat = /^(\d{2})\.(\d{2})\.(\d{4})$/;
  const dotMatch = dateStr.match(dotFormat);
  if (dotMatch) {
      const isoStr = `${dotMatch[3]}-${dotMatch[2]}-${dotMatch[1]}`;
      return new Date(isoStr);
  }
  
  return new Date('Invalid');
}

export const run: ActionRun = async ({ logger }) => {
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    logger.warn({ }, 'Skipping old orders check - not in production environment');
    return;
  }

  try {
    // Get valid access token
    const accessToken = await rozetkaTokenManager.getValidToken();
    if (!accessToken) {
      logger.error({ }, 'Failed to fetch Rozetka access token');
      return;
    }

    // Fetch orders with PLANNED_CALLBACK status
    const orders = await getPlannedCallbackOrders(accessToken, logger);
    if (!orders || orders.length === 0) {
      return;
    }
    // Filter and log old orders (6+ days)
    const oldOrders = filterOldOrders(orders, 6, logger);

    if (oldOrders.length === 0) {
      return;
    }
    oldOrders.forEach(order => {
      const createdDate = order.created || order.created_at;
      const ageInDays = calculateAgeInDays(createdDate);
    });

    // Update status to 18 (CANCELLED: Не вдалося зв'язатися з покупцем)
    for (const order of oldOrders) {
      try {
        await changeRozetkaOrderStatus(
            order.id,
            ROZETKA_ORDER_STATUSES.CANCELLED, // 18
            accessToken
        );
      } catch (e: any) {
        logger.error({ orderId: order.id, error: e.message }, 'Failed to cancel order');
      }
    }
  } catch (error: any) {
    logger.error({
      error: error.message,
      stack: error.stack,
    }, 'Old Rozetka orders check failed');
    throw error;
  }
};

async function getPlannedCallbackOrders(accessToken: string, logger: any) {
  const ROZETKA_ORDERS_API_URL = `${ROZETKA_API_BASE_URL}/orders/search`;
  
  // Calculate date 6 days ago for filtering
  const now = new Date();
  const thresholdDate = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
  const createdTo = thresholdDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD

  const requestParams = {
    status: ROZETKA_ORDER_STATUSES.PLANNED_CALLBACK, // Correct parameter based on docs
    expand: 'purchases,delivery',
    created_to: createdTo // Filter orders created BEFORE 6 days ago
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
      const allOrders = response.data.content.orders;
      return allOrders.filter((o: any) => o.status === ROZETKA_ORDER_STATUSES.PLANNED_CALLBACK);
    } else {
      logger.error({ responseData: response.data }, '[getPlannedCallbackOrders] API returned success=false');
      return null;
    }

  } catch (error: any) {
    logger.error({
      error: error.message,
      responseStatus: error.response?.status,
      responseData: error.response?.data,
    }, '[getPlannedCallbackOrders] Request failed');
    return null;
  }
}

function filterOldOrders(orders: any[], daysThreshold: number, logger: any) {
  const now = new Date();
  const thresholdDate = new Date(now.getTime() - daysThreshold * 24 * 60 * 60 * 1000);

  return orders.filter(order => {
    // The field is 'created', not 'created_at' based on logs
    const dateStr = order.created || order.created_at; 
    const createdAt = parseRozetkaDate(dateStr);
    
    const isOld = createdAt < thresholdDate;

    if (isNaN(createdAt.getTime())) {
      logger.warn({ orderId: order.id, dateStr }, '[filterOldOrders] Failed to parse date for order');
      return false;
    }
    return isOld;
  });
}

function calculateAgeInDays(createdAt: string): number {
  const now = new Date();
  const created = parseRozetkaDate(createdAt);
  if (isNaN(created.getTime())) return -1;
  
  const diffInMs = now.getTime() - created.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  return diffInDays;
}

export const options = {
  triggers: {
    scheduler: [{ cron: '0 10 * * *' }], // Runs daily at 10 AM
  },
};