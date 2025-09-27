import { ActionOptions } from 'gadget-server';

export const run = async ({ params, api }: any) => {
  console.log('verifyOrderPayments called with params:', params);

  try {
    const { orderIds } = params;

    if (!orderIds || !Array.isArray(orderIds)) {
      throw new Error('orderIds parameter is required and must be an array');
    }

    // Extract numeric IDs from Shopify GID format
    // Convert "gid://shopify/Order/123456" to "123456"
    const numericOrderIds = orderIds.map((id: string) => {
      if (id.startsWith('gid://shopify/Order/')) {
        return id.split('/').pop(); // Extract the last part after the last '/'
      }
      return id; // If it's already numeric, return as-is
    });

    console.log('Original orderIds:', orderIds);
    console.log('Converted numericOrderIds:', numericOrderIds);

    // Fetch selected orders
    const orders = await api.shopifyOrder.findMany({
      filter: { id: { in: numericOrderIds } },
      select: {
        id: true,
        name: true,
        totalPriceSet: true,
        createdAt: true,
        financialStatus: true,
      },
    });

    console.log(`Found ${orders.length} orders`);

    // Debug: Log order details
    orders.forEach((order: any, index: number) => {
      const orderAmount = parseFloat(
        order.totalPriceSet?.shopMoney?.amount || '0'
      );
      console.log(`DEBUG - Order ${index + 1}:`, {
        id: order.id,
        name: order.name,
        amount: orderAmount,
        currency: order.totalPriceSet?.shopMoney?.currencyCode,
        createdAt: order.createdAt,
        financialStatus: order.financialStatus,
        totalPriceSet: order.totalPriceSet,
      });
    });

    // Fetch recent bank transactions (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    console.log(
      `DEBUG - Searching for transactions after: ${thirtyDaysAgo.toISOString()}`
    );

    const transactions = await api.bankTransaction.findMany({
      filter: {
        transactionDateTime: { greaterThan: thirtyDaysAgo },
        type: { equals: 'income' }, // Only incoming payments
      },
      select: {
        id: true,
        amount: true,
        transactionDateTime: true,
        description: true,
        currency: true,
      },
    });

    console.log(`Found ${transactions.length} recent transactions`);

    // Debug: Log transaction details
    transactions.slice(0, 40).forEach((tx: any, index: number) => {
      console.log(`DEBUG - Transaction ${index + 1}:`, {
        id: tx.id,
        amount: tx.amount,
        currency: tx.currency,
        date: tx.transactionDateTime,
        description: tx.description?.substring(0, 50),
      });
    });

    if (transactions.length > 10) {
      console.log(
        `DEBUG - ... and ${transactions.length - 10} more transactions`
      );
    }

    // Simple matching logic: exact amount + within 7 days
    const results = orders.map((order: any) => {
      console.log('order', JSON.stringify(order, null, 2));
      const orderAmount = parseFloat(
        order.totalPriceSet?.shop_money?.amount || '0'
      );
      const orderDate = new Date(order.createdAt);

      console.log(`\nDEBUG - Matching for Order ${order.name}:`);
      console.log(`  Order Amount: ${orderAmount}`);
      console.log(`  Order Date: ${orderDate.toISOString()}`);
      console.log(`  Looking for transactions within 7 days...`);

      const matches = transactions.filter((tx: any) => {
        const txAmount = tx.amount || 0;
        const amountDiff = Math.abs(txAmount - orderAmount);
        const amountMatch = amountDiff < 0.01;

        const txDateTime = tx.transactionDateTime
          ? new Date(tx.transactionDateTime)
          : new Date();
        const timeDiff = Math.abs(txDateTime.getTime() - orderDate.getTime());
        const daysDiff = timeDiff / (24 * 60 * 60 * 1000);
        const dateMatch = timeDiff < 7 * 24 * 60 * 60 * 1000;

        // Debug each transaction check
        if (amountMatch || daysDiff <= 7) {
          console.log(`  Checking Transaction ${tx.id}:`);
          console.log(
            `    Amount: ${txAmount} (diff: ${amountDiff.toFixed(4)}) - ${
              amountMatch ? 'MATCH' : 'NO MATCH'
            }`
          );
          console.log(
            `    Date: ${txDateTime.toISOString()} (${daysDiff.toFixed(
              2
            )} days diff) - ${dateMatch ? 'MATCH' : 'NO MATCH'}`
          );
          console.log(
            `    Overall: ${
              amountMatch && dateMatch ? 'FULL MATCH ✓' : 'NO MATCH ✗'
            }`
          );
          console.log(
            `    Description: ${tx.description?.substring(0, 50)}...`
          );
        }

        return amountMatch && dateMatch;
      });

      console.log(
        `  Found ${matches.length} matching transactions for order ${order.name}`
      );

      return {
        orderId: order.id,
        orderName: order.name || '',
        orderAmount: orderAmount,
        orderDate: order.createdAt,
        financialStatus: order.financialStatus || '',
        matchCount: matches.length,
        matches: matches.map((tx: any) => ({
          transactionId: tx.id,
          amount: tx.amount || 0,
          date: tx.transactionDateTime || '',
          description: tx.description || '',
        })),
      };
    });

    console.log('Verification results:', results);

    return {
      success: true,
      results,
      summary: {
        ordersChecked: orders.length,
        transactionsScanned: transactions.length,
        ordersWithMatches: results.filter((r: any) => r.matchCount > 0).length,
      },
    };
  } catch (error) {
    console.error('Error in verifyOrderPayments:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

export const params = {
  orderIds: { type: 'array', items: { type: 'string' }, required: true },
};

export const options: ActionOptions = {
  actionType: 'custom',
};
