import { ActionOptions } from 'gadget-server';
import { updateOrderPaymentStatus } from '../utilities/shopify/api/orders/updateOrderPaymentStatus';
import { CheckboxService } from '../utilities/fiscal/checkboxService';
import { OrderToReceiptTransformer } from '../utilities/fiscal/orderToReceiptTransformer';
import {
  EXCLUDED_PAYMENT_CODES,
  NOVA_POSHTA_ACCOUNT,
} from '../utilities/fiscal/paymentConstants';

// Helper function to extract payment code from counterparty account
function extractPaymentCodeFromAccount(account: string): string | null {
  if (!account) return null;

  // Extract the 4-digit payment code from positions 15-19 of the account
  // Example: UA293052990000029023866100110 -> account.substring(15, 19) -> "2902"
  if (account.length >= 19) {
    return account.substring(15, 19);
  }

  return null;
}

// Helper function to create automatic check for verified payment
async function createAutomaticCheck(
  order: any,
  connections: any,
  api: any,
  orderData?: any
) {
  try {
    // Find the bank transaction matched to this order
    const bankTransaction = await api.bankTransaction.findFirst({
      filter: { matchedOrderId: { equals: order.id } },
      select: {
        id: true,
        counterpartyAccount: true,
        counterpartyName: true,
        checkIssuedAt: true,
        checkReceiptId: true,
        checkSkipReason: true,
      },
    });

    if (!bankTransaction) {
      console.log(
        `[createAutomaticCheck] No matched bank transaction found for order ${order.name}`
      );
      return {
        success: false,
        skipped: true,
        reason: 'No matched bank transaction found',
      };
    }

    console.log(
      `[createAutomaticCheck] Found bank transaction for order ${order.name}:`,
      {
        transactionId: bankTransaction.id,
        hasCheck: !!(bankTransaction.checkReceiptId || bankTransaction.checkIssuedAt),
        isSkipped: !!bankTransaction.checkSkipReason,
      }
    );

    // Check if check already issued
    if (bankTransaction.checkReceiptId || bankTransaction.checkIssuedAt) {
      console.log(
        `[createAutomaticCheck] Skipping: Check already issued for order ${order.name} at ${bankTransaction.checkIssuedAt}`
      );
      return {
        success: false,
        skipped: true,
        reason: `Check already issued for this payment (Receipt ID: ${
          bankTransaction.checkReceiptId || 'N/A'
        })`,
      };
    }

    // Check if check was previously skipped
    if (bankTransaction.checkSkipReason) {
      console.log(
        `[createAutomaticCheck] Skipping: Check previously skipped for order ${order.name}: ${bankTransaction.checkSkipReason}`
      );
      return {
        success: false,
        skipped: true,
        reason: bankTransaction.checkSkipReason,
      };
    }

    // Extract and validate payment code
    const paymentCode = extractPaymentCodeFromAccount(
      bankTransaction.counterpartyAccount
    );

    // Skip check creation for excluded payment codes
    if (paymentCode && EXCLUDED_PAYMENT_CODES.includes(paymentCode)) {
      const skipReason = `Excluded payment code: ${paymentCode} (doesn't require check)`;

      // Update bank transaction with skip reason
      await api.bankTransaction.update(bankTransaction.id, {
        checkSkipReason: skipReason,
      });

      console.log(
        `[createAutomaticCheck] Updated bankTransaction ${bankTransaction.id} with skip reason: ${skipReason}`
      );

      // Add note to order explaining why check wasn't created
      const restrictionNote = `🧾 Automatic Check Creation Skipped
Reason: Payment code ${paymentCode} doesn't require check issuance
Counterparty: ${bankTransaction.counterpartyName || 'Unknown'}
Account: ${bankTransaction.counterpartyAccount || 'Unknown'}
Date: ${new Date().toISOString()}
Note: This payment code (2600, 2902, 2909, or 2920) is excluded from automatic check creation`;

      await updateOrderPaymentStatus(connections, order.id, order.shopId, {
        note: restrictionNote,
      });

      return {
        success: false,
        skipped: true,
        reason: skipReason,
      };
    }

    // Check Nova Poshta account restriction
    if (bankTransaction.counterpartyAccount === NOVA_POSHTA_ACCOUNT) {
      const skipReason = 'Nova Poshta account restriction';

      // Update bank transaction with skip reason
      await api.bankTransaction.update(bankTransaction.id, {
        checkSkipReason: skipReason,
      });

      console.log(
        `[createAutomaticCheck] Updated bankTransaction ${bankTransaction.id} with Nova Poshta skip reason`
      );

      const restrictionNote = `🧾 Automatic Check Creation Skipped
Reason: Nova Poshta account restriction
Counterparty: ${bankTransaction.counterpartyName || 'Nova Poshta'}
Account: ${bankTransaction.counterpartyAccount}
Date: ${new Date().toISOString()}
Note: Nova Poshta payments are excluded from automatic check creation`;

      await updateOrderPaymentStatus(connections, order.id, order.shopId, {
        note: restrictionNote,
      });

      return {
        success: false,
        skipped: true,
        reason: skipReason,
      };
    }

    console.log(
      `[createAutomaticCheck] Proceeding to create check for order ${order.name}`
    );

    // Initialize Checkbox service
    const checkboxService = new CheckboxService();
    await checkboxService.signIn();
    await checkboxService.ensureShiftOpen();

    // Require orderData for automatic check creation
    // The frontend provides orderData with pre-calculated AI variants
    if (!orderData) {
      return {
        success: false,
        skipped: true,
        reason: 'Order data with variants not provided',
      };
    }

    // Use the order object already passed in (has id, name, shopId, etc.)
    // and the orderData from frontend (has line items with AI-selected variants)
    const receiptBody = OrderToReceiptTransformer.transformOrderFromDataForSell(
      orderData,
      order
    );

    // Create the sell receipt
    const receipt = await checkboxService.createSellReceipt(receiptBody);

    console.log(
      `[createAutomaticCheck] Check created successfully for order ${order.name}, receipt ID: ${receipt.id}`
    );

    // Update bank transaction with check information
    const checkIssuedAt = new Date();
    await api.bankTransaction.update(bankTransaction.id, {
      checkReceiptId: receipt.id,
      checkIssuedAt: checkIssuedAt,
    });

    console.log(
      `[createAutomaticCheck] Updated bankTransaction ${bankTransaction.id} with check details:`,
      {
        checkReceiptId: receipt.id,
        checkIssuedAt: checkIssuedAt,
      }
    );

    // Add receipt info to order notes
    const checkNote = `🧾 Automatic Check Created
Receipt ID: ${receipt.id}
Fiscal Code: ${receipt.fiscal_code || 'N/A'}
Receipt URL: ${receipt.receipt_url || 'N/A'}
Created: ${checkIssuedAt.toISOString()}
Reason: Payment verified and order marked as paid`;

    await updateOrderPaymentStatus(connections, order.id, order.shopId, {
      note: checkNote,
    });

    return {
      success: true,
      receiptId: receipt.id,
      fiscalCode: receipt.fiscal_code,
      receiptUrl: receipt.receipt_url,
    };
  } catch (error) {
    console.error(`Failed to create check for order ${order.name}:`, error);

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
      console.error(`Failed to add error note:`, noteError);
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
  try {
    const { orderIds, autoCreateChecks = true, orderData } = params;

    console.log(`=== Payment Verification Started ===`);
    console.log(`  Orders: ${orderIds?.length || 0}`);
    console.log(`  Auto-create checks: ${autoCreateChecks}`);
    console.log(`  OrderData provided: ${orderData ? 'YES' : 'NO'}`);
    if (orderData) {
      console.log(`  OrderData count: ${orderData.length}`);
    }

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

    // Check for existing verifications using bankTransaction.matchedOrderId
    const existingMatches = await api.bankTransaction.findMany({
      filter: { matchedOrderId: { in: numericOrderIds } },
      select: {
        id: true,
        matchedOrderId: true,
        checkIssuedAt: true,
        checkReceiptId: true,
        checkSkipReason: true,
      },
    });

    // Create a set of already matched bankTransactionIds to avoid duplicates
    const matchedTransactionIds = new Set(
      existingMatches.map((match: { id: any }) => match.id)
    );

    // Log existing matches for debugging
    console.log(`Found ${existingMatches.length} existing payment matches in bankTransaction`);
    existingMatches.forEach((match: any) => {
      console.log(
        `  Order ${match.matchedOrderId}: hasCheck=${!!(match.checkReceiptId || match.checkIssuedAt)}, isSkipped=${!!match.checkSkipReason}`
      );
    });

    // Create a map of already verified orders
    const verifiedOrderIds = new Set(
      existingMatches.map((match: { matchedOrderId: any }) => match.matchedOrderId)
    );

    // Fetch selected orders
    const orders = await api.shopifyOrder.findMany({
      filter: { id: { in: numericOrderIds } },
      select: {
        id: true,
        name: true,
        totalPriceSet: true,
        currentTotalPriceSet: true,
        createdAt: true,
        financialStatus: true,
        shopId: true,
      },
    });

    // Refresh bank data since last sync, then fetch recent transactions
    try {
      await refreshBankDataSinceLastSync(api);
    } catch (refreshError) {
      console.warn('Bank data refresh failed:', refreshError);
    }

    // Fetch recent bank transactions (last 10 days)
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

    const transactions = await api.bankTransaction.findMany({
      filter: {
        transactionDateTime: { greaterThan: tenDaysAgo },
        type: { equals: 'income' }, // Only incoming payments
      },
      sort: { transactionDateTime: 'Descending' }, // Most recent first
      first: 250,
      select: {
        id: true,
        amount: true,
        transactionDateTime: true,
        description: true,
      },
    });

    // Simple matching logic: exact amount + within 7 days
    const results = [];
    const currentTime = new Date();

    for (const order of orders) {
      // Use currentTotalPriceSet which excludes deleted/refunded items
      const orderAmount = parseFloat(
        order.currentTotalPriceSet?.shop_money?.amount || '0'
      );
      const orderDate = new Date(order.createdAt);

      // Check if this order is already verified (has a matched bank transaction)
      const existingMatch = existingMatches.find(
        (match: any) => match.matchedOrderId === order.id
      );

      if (existingMatch) {
        console.log(`Order ${order.name} already verified`);

        const hasCheck = !!(existingMatch.checkReceiptId || existingMatch.checkIssuedAt);
        const isSkipped = !!existingMatch.checkSkipReason;

        // Check if we need to create a check for this previously verified order
        if (autoCreateChecks && !hasCheck && !isSkipped) {
          console.log(
            `Attempting to create check for previously verified order ${order.name} (ID: ${order.id})`
          );
          console.log(
            `Check status - hasCheck: ${hasCheck}, isSkipped: ${isSkipped}`
          );

          try {
            // Find the corresponding orderData for this specific order
            const currentOrderData = orderData?.find(
              (od: any) =>
                od.id === order.id ||
                od.id === `gid://shopify/Order/${order.id}`
            );

            console.log(
              `Found orderData for order ${order.name}:`,
              currentOrderData ? 'YES' : 'NO'
            );
            if (currentOrderData) {
              console.log(
                `OrderData has ${
                  currentOrderData.lineItems?.length || 0
                } line items`
              );
            }

            const checkResult = await createAutomaticCheck(
              order,
              connections,
              api,
              currentOrderData
            );

            if (checkResult?.success) {
              console.log(
                `Check created for previously verified order ${order.name}`
              );
            } else if (checkResult?.skipped) {
              console.log(
                `Check skipped for previously verified order ${order.name}: ${checkResult.reason}`
              );
            }
          } catch (checkError) {
            console.error(
              `Check creation error for previously verified order ${order.name}:`,
              checkError
            );
          }

          // Fetch updated bank transaction info after check creation attempt
          const updatedTransaction = await api.bankTransaction.findFirst({
            filter: { matchedOrderId: { equals: order.id } },
            select: {
              checkIssuedAt: true,
              checkReceiptId: true,
              checkSkipReason: true,
            },
          });

          if (updatedTransaction) {
            existingMatch.checkIssuedAt = updatedTransaction.checkIssuedAt;
            existingMatch.checkReceiptId = updatedTransaction.checkReceiptId;
            existingMatch.checkSkipReason = updatedTransaction.checkSkipReason;
          }
        }

        results.push({
          orderId: order.id,
          orderName: order.name || '',
          orderAmount: orderAmount,
          orderDate: order.createdAt,
          financialStatus: order.financialStatus || '',
          matchCount: 1,
          alreadyVerified: true,
          verifiedAt: null, // No longer tracked in bankTransaction
          matchConfidence: null, // No longer tracked in bankTransaction
          // Add check information
          checkIssued: !!(existingMatch.checkReceiptId || existingMatch.checkIssuedAt),
          checkIssuedAt: existingMatch.checkIssuedAt,
          checkReceiptId: existingMatch.checkReceiptId,
          checkSkipped: !!existingMatch.checkSkipReason,
          checkSkipReason: existingMatch.checkSkipReason,
          matches: [
            {
              transactionId: existingMatch.id,
              amount: orderAmount,
              date: null,
              description: 'Previously verified payment',
            },
          ],
        });
        continue;
      }

      const matches = transactions.filter((tx: any) => {
        const txAmount = tx.amount || 0;
        const amountDiff = Math.abs(txAmount - orderAmount);
        const amountMatch = amountDiff < 0.01;

        const txDateTime = tx.transactionDateTime
          ? new Date(tx.transactionDateTime)
          : new Date();
        const timeDiff = Math.abs(txDateTime.getTime() - orderDate.getTime());
        const dateMatch = timeDiff < 7 * 24 * 60 * 60 * 1000;

        // Skip already-matched transactions (prevents greedy first-order matching bug)
        const notAlreadyMatched = !matchedTransactionIds.has(tx.id);

        return amountMatch && dateMatch && notAlreadyMatched;
      });

      console.log(
        `Found ${matches.length} matching transactions for order ${order.name}`
      );

      // Match to first available transaction only (one-to-one matching)
      if (matches.length > 0) {
        const firstMatch = matches[0];
        const txId = firstMatch.id;
        const txAmount = firstMatch.amount || 0;
        const amountDiff = Math.abs(txAmount - orderAmount);
        const txDateTime = firstMatch.transactionDateTime
          ? new Date(firstMatch.transactionDateTime)
          : new Date();
        const daysDiff =
          Math.abs(txDateTime.getTime() - orderDate.getTime()) /
          (24 * 60 * 60 * 1000);

        // Calculate confidence score (100% for exact match, lower for differences)
        let confidence = 100;
        if (amountDiff > 0) confidence -= (amountDiff / orderAmount) * 10;
        if (daysDiff > 1) confidence -= daysDiff * 2;
        confidence = Math.max(50, Math.min(100, confidence));

        try {
          // Update bank transaction with matched order
          await api.bankTransaction.update(txId, {
            matchedOrderId: order.id,
          });

          // Mark as used immediately to prevent duplicate matching in this run
          matchedTransactionIds.add(txId);

          console.log(
            `[verifyOrderPayments] Matched order ${order.id} to bankTransaction ${txId}`,
            {
              confidence: Math.round(confidence),
              amountDiff: amountDiff.toFixed(4),
              daysDiff: daysDiff.toFixed(2),
            }
          );
        } catch (saveError) {
          console.error(
            `Failed to save match for order ${order.id}:`,
            saveError
          );
        }

        // Update Shopify order after successful match
        try {
          const matchDetails = `₴${firstMatch.amount} on ${new Date(
            firstMatch.transactionDateTime
          ).toLocaleDateString()}`;

          await updateOrderPaymentStatus(connections, order.id, order.shopId, {
            note: `🔍 Payment Verification Complete\nMatching transaction found: ${matchDetails}\nConfidence: ${Math.round(
              confidence
            )}%\n\nVerified at: ${currentTime.toISOString()}`,
            markAsPaid: true,
          });

          console.log(`Successfully updated order ${order.name}`);

          // Create automatic check for verified payment (if enabled)
          if (autoCreateChecks) {
            try {
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
                console.log(`Check created for order ${order.name}`);
              } else if (checkResult?.skipped) {
                console.log(
                  `Check skipped for order ${order.name}: ${checkResult.reason}`
                );
              }
            } catch (checkError) {
              console.error(
                `Check creation error for order ${order.name}:`,
                checkError
              );
            }
          }
        } catch (shopifyError) {
          console.error(
            `Failed to update Shopify order ${order.id}:`,
            shopifyError
          );
        }
      }

      // Fetch check information for newly verified orders (from bankTransaction only)
      let checkInfo = {
        checkIssued: false,
        checkIssuedAt: null as Date | null,
        checkReceiptId: null as string | null,
        checkSkipped: false,
        checkSkipReason: null as string | null,
      };

      if (matches.length > 0) {
        try {
          // Find the bank transaction matched to this order
          const bankTransaction = await api.bankTransaction.findFirst({
            filter: { matchedOrderId: { equals: order.id } },
            select: {
              id: true,
              checkIssuedAt: true,
              checkReceiptId: true,
              checkSkipReason: true,
            },
          });

          if (bankTransaction) {
            // Check if check issued
            if (bankTransaction.checkReceiptId || bankTransaction.checkIssuedAt) {
              checkInfo.checkIssued = true;
              checkInfo.checkIssuedAt = bankTransaction.checkIssuedAt;
              checkInfo.checkReceiptId = bankTransaction.checkReceiptId;
              console.log(
                `[verifyOrderPayments] Check issued for order ${order.id}: ${bankTransaction.checkReceiptId}`
              );
            }

            // Check if skipped
            if (bankTransaction.checkSkipReason) {
              checkInfo.checkSkipped = true;
              checkInfo.checkSkipReason = bankTransaction.checkSkipReason;
              console.log(
                `[verifyOrderPayments] Check skipped for order ${order.id}: ${bankTransaction.checkSkipReason}`
              );
            }
          } else {
            console.log(
              `[verifyOrderPayments] No bank transaction found for order ${order.id}`
            );
          }
        } catch (err) {
          console.error(
            `Error fetching check info for order ${order.id}:`,
            err
          );
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
        // Add check information
        checkIssued: checkInfo.checkIssued,
        checkIssuedAt: checkInfo.checkIssuedAt,
        checkReceiptId: checkInfo.checkReceiptId,
        checkSkipped: checkInfo.checkSkipped,
        checkSkipReason: checkInfo.checkSkipReason,
        matches: matches.map((tx: any) => ({
          transactionId: tx.id,
          amount: tx.amount || 0,
          date: tx.transactionDateTime || '',
          description: tx.description || '',
        })),
      });
    }

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
