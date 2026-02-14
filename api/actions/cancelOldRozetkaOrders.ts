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
      const createdDate = order.created || order.created_at;
      const ageInDays = calculateAgeInDays(createdDate);
      console.log({
        orderId: order.id,
        createdAtRaw: createdDate,
        ageInDays: ageInDays,
        recipientPhone: order.recipient_phone,
      });
    });

    // Update status to 18 (CANCELLED: Не вдалося зв'язатися з покупцем)
    for (const order of oldOrders) {
      try {
        console.log(`Cancelling order ${order.id}...`);
        await changeRozetkaOrderStatus(
            order.id, 
            ROZETKA_ORDER_STATUSES.CANCELLED, // 18 
            accessToken
        );
      } catch (e: any) {
        console.error(`Failed to cancel order ${order.id}: ${e.message}`);
      }
    }

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
  
  // Calculate date 6 days ago for filtering
  const now = new Date();
  const thresholdDate = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
  const createdTo = thresholdDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD

  const requestParams = {
    status: ROZETKA_ORDER_STATUSES.PLANNED_CALLBACK, // Correct parameter based on docs
    expand: 'purchases,delivery',
    created_to: createdTo // Filter orders created BEFORE 6 days ago
  };

  console.log('[getPlannedCallbackOrders] Fetching orders with status 47 older than 6 days', {
    status: ROZETKA_ORDER_STATUSES.PLANNED_CALLBACK,
    created_to: createdTo
  });

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
      console.log(`[getPlannedCallbackOrders] Successfully fetched ${allOrders.length} orders`);
      
      return allOrders.filter((o: any) => o.status === ROZETKA_ORDER_STATUSES.PLANNED_CALLBACK);
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
    // The field is 'created', not 'created_at' based on logs
    const dateStr = order.created || order.created_at; 
    const createdAt = parseRozetkaDate(dateStr);
    
    const isOld = createdAt < thresholdDate;

    if (isNaN(createdAt.getTime())) {
      console.warn(`[filterOldOrders] Failed to parse date for order ${order.id}: ${dateStr}`);
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