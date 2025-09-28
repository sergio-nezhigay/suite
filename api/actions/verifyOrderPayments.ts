import { ActionOptions } from 'gadget-server';
import { updateOrderPaymentStatus } from '../utilities/shopify/api/orders/updateOrderPaymentStatus';
import { CheckboxService } from '../utilities/fiscal/checkboxService';
import { OrderToReceiptTransformer } from '../utilities/fiscal/orderToReceiptTransformer';

// Helper function to create automatic check for verified payment
async function createAutomaticCheck(
  order: any,
  connections: any,
  api: any,
  orderData?: any
) {
  try {
    console.log(
      `🧾 Creating automatic check for verified order ${order.name}...`
    );

    // Initialize Checkbox service
    const checkboxService = new CheckboxService();
    await checkboxService.signIn();
    await checkboxService.ensureShiftOpen();

    // Fetch full order details with line items for the receipt
    const fullOrder = await api.shopifyOrder.findFirst({
      filter: { id: { equals: order.id } },
      select: {
        id: true,
        name: true,
        totalPriceSet: true,
        lineItems: {
          select: {
            title: true,
            quantity: true,
            priceSet: true,
            price: true,
          },
        },
      },
    });

    if (
      !fullOrder ||
      !fullOrder.lineItems ||
      fullOrder.lineItems.length === 0
    ) {
      console.log(
        `⚠️ No line items found for order ${order.name}, skipping check creation`
      );
      return null;
    }

    console.log(
      `📋 Found ${fullOrder.lineItems.length} line items for order ${fullOrder.name}`
    );

    const receiptBody = orderData
      ? OrderToReceiptTransformer.transformOrderFromDataForSell(
          orderData,
          fullOrder
        )
      : OrderToReceiptTransformer.transformOrderForSell(fullOrder);

    // Create the sell receipt
    const receipt = await checkboxService.createSellReceipt(receiptBody);

    console.log(
      `✅ Created check/receipt ${receipt.id} for order ${order.name}`
    );

    // Add receipt info to order notes
    const checkNote = `🧾 Automatic Check Created
Receipt ID: ${receipt.id}
Fiscal Code: ${receipt.fiscal_code || 'N/A'}
Receipt URL: ${receipt.receipt_url || 'N/A'}
Created: ${new Date().toISOString()}
Reason: Payment verified and order marked as paid`;

    await updateOrderPaymentStatus(connections, order.id, order.shopId, {
      note: checkNote,
    });

    console.log(`📝 Added check details to order ${order.name} notes`);

    return {
      success: true,
      receiptId: receipt.id,
      fiscalCode: receipt.fiscal_code,
      receiptUrl: receipt.receipt_url,
    };
  } catch (error) {
    console.error(
      `❌ Failed to create automatic check for order ${order.name}:`,
      error
    );

    // Add error note to order but don't fail the payment verification
    try {
      const errorNote = `🧾 Automatic Check Creation Failed
Error: ${error instanceof Error ? error.message : 'Unknown error'}
Attempted: ${new Date().toISOString()}
Note: Payment verification was successful, check creation can be done manually`;

      await updateOrderPaymentStatus(connections, order.id, order.shopId, {
        note: errorNote,
      });
    } catch (noteError) {
      console.error(
        `Failed to add error note to order ${order.name}:`,
        noteError
      );
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Helper function to refresh bank data since last sync
async function refreshBankDataSinceLastSync(api: any) {
  try {
    // Get most recent sync timestamp
    const lastSyncedTransaction = await api.bankTransaction.findFirst({
      sort: { syncedAt: 'Descending' },
      select: { syncedAt: true },
    });

    const lastSyncTime =
      lastSyncedTransaction?.syncedAt ||
      new Date(Date.now() - 24 * 60 * 60 * 1000);
    const now = new Date();
    const daysSinceSync = Math.ceil(
      (now.getTime() - lastSyncTime.getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysToFetch = Math.max(1, Math.min(daysSinceSync, 10));

    console.log(
      `Refreshing bank data: last sync ${lastSyncTime.toISOString()}, fetching ${daysToFetch} days`
    );

    // Trigger sync for the gap period
    const syncResult = await api.syncBankTransactions({
      daysBack: daysToFetch,
    });

    if (syncResult.success) {
      console.log(
        `Bank refresh completed: ${syncResult.summary.created} new, ${syncResult.summary.duplicates} duplicates`
      );
    } else {
      console.warn(`Bank refresh failed: ${syncResult.error}`);
    }

    return syncResult;
  } catch (error) {
    console.error('Error in refreshBankDataSinceLastSync:', error);
    throw error;
  }
}

export const run = async ({ params, api, connections }: any) => {
  console.log('verifyOrderPayments called with params:', params);

  try {
    const { orderIds, autoCreateChecks = true, orderData } = params;

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

    // Check for existing verifications first
    const existingMatches = await api.orderPaymentMatch.findMany({
      filter: { orderId: { in: numericOrderIds } },
      select: {
        id: true,
        orderId: true,
        bankTransactionId: true,
        verifiedAt: true,
        matchConfidence: true,
        notes: true,
      },
    });

    console.log(
      `Found ${existingMatches.length} existing payment verifications`
    );

    // Create a map of already verified orders
    const verifiedOrderIds = new Set(
      existingMatches.map((match: { orderId: any }) => match.orderId)
    );
    const unverifiedOrderIds = numericOrderIds.filter(
      (id) => !verifiedOrderIds.has(id)
    );

    console.log(
      `${verifiedOrderIds.size} orders already verified, ${unverifiedOrderIds.length} need verification`
    );

    // Fetch selected orders
    const orders = await api.shopifyOrder.findMany({
      filter: { id: { in: numericOrderIds } },
      select: {
        id: true,
        name: true,
        totalPriceSet: true,
        createdAt: true,
        financialStatus: true,
        shopId: true,
      },
    });

    console.log(`Found ${orders.length} orders`);

    // Debug: Log order details
    orders.forEach((order: any, index: number) => {
      const orderAmount = parseFloat(
        order.totalPriceSet?.shop_money?.amount || '0'
      );
      console.log(`DEBUG - Order ${index + 1}:`, {
        id: order.id,
        name: order.name,
        amount: orderAmount,
        currency: order.totalPriceSet?.shop_money?.currencyCode,
        createdAt: order.createdAt,
        financialStatus: order.financialStatus,
        totalPriceSet: order.totalPriceSet,
      });
    });

    // Refresh bank data since last sync, then fetch recent transactions
    try {
      console.log('Ensuring fresh bank data...');
      await refreshBankDataSinceLastSync(api);
    } catch (refreshError) {
      console.warn(
        'Bank data refresh failed, proceeding with existing data:',
        refreshError
      );
    }

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
    const results = [];
    const currentTime = new Date();

    for (const order of orders) {
      console.log('order', JSON.stringify(order, null, 2));
      const orderAmount = parseFloat(
        order.totalPriceSet?.shop_money?.amount || '0'
      );
      const orderDate = new Date(order.createdAt);

      // Check if this order is already verified
      const existingMatch = existingMatches.find(
        (match: any) => match.orderId === order.id
      );

      if (existingMatch) {
        console.log(`\nDEBUG - Order ${order.name} already verified:`);
        console.log(`  Verified at: ${existingMatch.verifiedAt}`);
        console.log(`  Confidence: ${existingMatch.matchConfidence}%`);

        results.push({
          orderId: order.id,
          orderName: order.name || '',
          orderAmount: orderAmount,
          orderDate: order.createdAt,
          financialStatus: order.financialStatus || '',
          matchCount: 1,
          alreadyVerified: true,
          verifiedAt: existingMatch.verifiedAt,
          matchConfidence: existingMatch.matchConfidence,
          matches: [
            {
              transactionId: existingMatch.bankTransactionId,
              amount: orderAmount, // We'll use order amount as placeholder
              date: existingMatch.verifiedAt,
              description: 'Previously verified payment',
            },
          ],
        });
        continue;
      }

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

      // Save new matches to database
      if (matches.length > 0) {
        for (const match of matches) {
          try {
            const txAmount = (match as any).amount || 0;
            const amountDiff = Math.abs(txAmount - orderAmount);
            const txDateTime = (match as any).transactionDateTime
              ? new Date((match as any).transactionDateTime)
              : new Date();
            const daysDiff =
              Math.abs(txDateTime.getTime() - orderDate.getTime()) /
              (24 * 60 * 60 * 1000);

            // Calculate confidence score (100% for exact match, lower for differences)
            let confidence = 100;
            if (amountDiff > 0) confidence -= (amountDiff / orderAmount) * 10; // Reduce by amount difference
            if (daysDiff > 1) confidence -= daysDiff * 2; // Reduce by days difference
            confidence = Math.max(50, Math.min(100, confidence)); // Keep between 50-100

            const savedMatch = await api.orderPaymentMatch.create({
              orderId: order.id,
              bankTransactionId: (match as any).id,
              matchConfidence: Math.round(confidence),
              verifiedAt: currentTime,
              matchedBy: 'manual',
              notes: `Amount diff: ${amountDiff.toFixed(
                4
              )}, Days diff: ${daysDiff.toFixed(2)}`,
              orderAmount: orderAmount,
              transactionAmount: txAmount,
              amountDifference: amountDiff,
              daysDifference: daysDiff,
            });

            console.log(
              `  Saved payment match ${savedMatch.id} with ${confidence.toFixed(
                1
              )}% confidence`
            );
          } catch (saveError) {
            console.error(
              `  Failed to save match for order ${order.id}:`,
              saveError
            );
          }
        }

        // Update Shopify order after successful matches
        try {
          console.log(
            `  Updating Shopify order ${order.name} payment status...`
          );

          const matchDetails = matches
            .map(
              (match: any, index: number) =>
                `${index + 1}. $${match.amount} on ${new Date(
                  match.transactionDateTime
                ).toLocaleDateString()}`
            )
            .join('\n');

          await updateOrderPaymentStatus(connections, order.id, order.shopId, {
            note: `🔍 Payment Verification Complete\n${
              matches.length
            } matching transaction(s) found:\n${matchDetails}\n\nVerified at: ${currentTime.toISOString()}`,
            markAsPaid: true,
          });

          console.log(`  ✅ Successfully updated Shopify order ${order.name}`);

          // Create automatic check for verified payment (if enabled)
          if (autoCreateChecks) {
            try {
              console.log(
                `🧾 Attempting automatic check creation for order ${order.name}...`
              );
              // Find the corresponding orderData for this specific order
              const currentOrderData = orderData?.find(
                (od: any) => od.id === order.id
              );
              const checkResult = await createAutomaticCheck(
                order,
                connections,
                api,
                currentOrderData
              );

              if (checkResult?.success) {
                console.log(
                  `✅ Automatic check created successfully for order ${order.name}`
                );
                console.log(`   Receipt ID: ${checkResult.receiptId}`);
                console.log(`   Fiscal Code: ${checkResult.fiscalCode}`);
              } else {
                console.log(
                  `⚠️ Automatic check creation failed for order ${
                    order.name
                  }: ${checkResult?.error || 'Unknown error'}`
                );
              }
            } catch (checkError) {
              console.error(
                `❌ Error during automatic check creation for order ${order.name}:`,
                checkError
              );
              // Don't throw - payment verification was successful, check creation is secondary
            }
          } else {
            console.log(
              `⚙️ Automatic check creation disabled for order ${order.name}`
            );
          }
        } catch (shopifyError) {
          console.error(
            `  ❌ Failed to update Shopify order ${order.id}:`,
            shopifyError
          );
          // Don't throw - we want verification to continue even if Shopify update fails
        }
      }

      results.push({
        orderId: order.id,
        orderName: order.name || '',
        orderAmount: orderAmount,
        orderDate: order.createdAt,
        financialStatus: order.financialStatus || '',
        matchCount: matches.length,
        alreadyVerified: false,
        verifiedAt: matches.length > 0 ? currentTime : null,
        matches: matches.map((tx: any) => ({
          transactionId: tx.id,
          amount: tx.amount || 0,
          date: tx.transactionDateTime || '',
          description: tx.description || '',
        })),
      });
    }

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
  autoCreateChecks: { type: 'boolean', default: true, required: false },
  orderData: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        lineItems: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              quantity: { type: 'number' },
              price: { type: 'string' },
              variant: { type: 'string' },
            },
          },
        },
      },
    },
    required: false,
  },
};

export const options: ActionOptions = {
  actionType: 'custom',
};
