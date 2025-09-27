import { ActionOptions } from 'gadget-server';

export const run = async ({ params, api }: any) => {
  console.log('verifyOrderPayments called with params:', params);

  try {
    const { orderIds } = params;

    if (!orderIds || !Array.isArray(orderIds)) {
      throw new Error('orderIds parameter is required and must be an array');
    }

    // Fetch selected orders
    const orders = await api.shopifyOrder.findMany({
      filter: { id: { in: orderIds } },
      select: {
        id: true,
        name: true,
        totalPriceSet: true,
        createdAt: true,
        financialStatus: true,
      },
    });

    console.log(`Found ${orders.length} orders`);

    // Fetch recent bank transactions (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
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

    // Simple matching logic: exact amount + within 7 days
    const results = orders.map((order: any) => {
      const orderAmount = parseFloat(
        order.totalPriceSet?.shopMoney?.amount || '0'
      );
      const orderDate = new Date(order.createdAt);

      const matches = transactions.filter((tx: any) => {
        const amountMatch = Math.abs((tx.amount || 0) - orderAmount) < 0.01;
        const txDateTime = tx.transactionDateTime ? new Date(tx.transactionDateTime) : new Date();
        const dateMatch =
          Math.abs(txDateTime.getTime() - orderDate.getTime()) < 7 * 24 * 60 * 60 * 1000;
        return amountMatch && dateMatch;
      });

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
