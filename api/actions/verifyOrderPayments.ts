import { ActionOptions } from 'gadget-server';
import { updateOrderPaymentStatus } from '../utilities/shopify/api/orders/updateOrderPaymentStatus';
import { CheckboxService } from '../utilities/fiscal/checkboxService';
import { OrderToReceiptTransformer } from '../utilities/fiscal/orderToReceiptTransformer';
import {
  EXCLUDED_PAYMENT_CODES,
  NOVA_POSHTA_ACCOUNT,
} from '../utilities/fiscal/paymentConstants';
import { timeIt } from 'api/utilities/timeIt';

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
  logger: any,
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
      return {
        success: false,
        skipped: true,
        reason: 'No matched bank transaction found',
      };
    }
    // Check if check already issued
    if (bankTransaction.checkReceiptId || bankTransaction.checkIssuedAt) {
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
    // Initialize Checkbox service
    const checkboxService = new CheckboxService();
    await timeIt('checkbox_signin', () => checkboxService.signIn(), logger);
    await timeIt('checkbox_ensure_shift', () => checkboxService.ensureShiftOpen(), logger);

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
    const receipt = await timeIt('checkbox_create_receipt',
      () => checkboxService.createSellReceipt(receiptBody), logger, { orderId: order.id });
    // Update bank transaction with check information
    const checkIssuedAt = new Date();
    await api.bankTransaction.update(bankTransaction.id, {
      checkReceiptId: receipt.id,
      checkIssuedAt: checkIssuedAt,
    });
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
    logger.error({ orderName: order.name, err: error }, '[DEBUG-PAYMENTS] Failed to create check for order');

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
      logger.error({ err: noteError }, 'Failed to add error note');
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

import { refreshBankDataSinceLastSync } from '../utilities/bank/refreshBankData';

export const run = async ({ params, api, connections, logger }: any) => {
  const actionStart = performance.now();
  try {
    const { orderIds, autoCreateChecks = true, orderData } = params;
    if (orderData) {
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
    const existingMatches = await timeIt<any[]>('query_existing_matches',
      () => api.bankTransaction.findMany({
        filter: { matchedOrderId: { in: numericOrderIds } },
        select: {
          id: true,
          matchedOrderId: true,
          checkIssuedAt: true,
          checkReceiptId: true,
          checkSkipReason: true,
        },
      }),
      logger,
      { order_count: orderIds.length }
    );

    // Create a set of already matched bankTransactionIds to avoid duplicates
    const matchedTransactionIds = new Set(
      existingMatches.map((match: { id: any }) => match.id)
    );

    // Log existing matches for debugging
    existingMatches.forEach((match: any) => {
    });

    // Fetch selected orders
    const orders = await timeIt<any[]>('query_shopify_orders',
      () => api.shopifyOrder.findMany({
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
      }),
      logger
    );

    // Refresh bank data since last sync, then fetch recent transactions
    try {
      await timeIt('refresh_bank_data', () => refreshBankDataSinceLastSync(api), logger);
    } catch (refreshError) {
      logger.warn({ err: refreshError }, 'Bank data refresh failed');
    }

    // Fetch recent bank transactions (last 10 days)
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

    const transactions = await timeIt<any[]>('query_bank_transactions',
      () => api.bankTransaction.findMany({
        filter: {
          transactionDateTime: { greaterThan: tenDaysAgo },
          type: { equals: 'income' }, // Only incoming payments
          matchedOrderId: { equals: null }, // Exclude already matched payments
        },
        sort: { transactionDateTime: 'Descending' }, // Most recent first
        first: 250,
        select: {
          id: true,
          amount: true,
          transactionDateTime: true,
          description: true,
        },
      }),
      logger
    );

    // Simple matching logic: exact amount + within 7 days
    const results: any[] = [];

    await timeIt('order_matching_loop', async () => {
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
        const hasCheck = !!(existingMatch.checkReceiptId || existingMatch.checkIssuedAt);
        const isSkipped = !!existingMatch.checkSkipReason;

        // Retry check only if matched but check previously failed (not skipped, not issued)
        if (autoCreateChecks && !hasCheck && !isSkipped) {
          const currentOrderData = orderData?.find(
            (od: any) => od.id === order.id || od.id === `gid://shopify/Order/${order.id}`
          );
          const checkResult = await createAutomaticCheck(order, connections, api, logger, currentOrderData);
          // Re-fetch updated check status
          const updated = await api.bankTransaction.findFirst({
            filter: { matchedOrderId: { equals: order.id } },
            select: { checkIssuedAt: true, checkReceiptId: true, checkSkipReason: true },
          });
          if (updated) {
            existingMatch.checkIssuedAt = updated.checkIssuedAt;
            existingMatch.checkReceiptId = updated.checkReceiptId;
            existingMatch.checkSkipReason = updated.checkSkipReason;
          }
        }

        results.push({
          orderId: order.id,
          orderName: order.name || '',
          orderAmount,
          orderDate: order.createdAt,
          financialStatus: order.financialStatus || '',
          matchCount: 1,
          checkIssued: !!(existingMatch.checkReceiptId || existingMatch.checkIssuedAt),
          checkIssuedAt: existingMatch.checkIssuedAt,
          checkReceiptId: existingMatch.checkReceiptId,
          checkSkipped: !!existingMatch.checkSkipReason,
          checkSkipReason: existingMatch.checkSkipReason,
          matches: [{ transactionId: existingMatch.id, amount: orderAmount, date: null, description: 'Previously matched payment' }],
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
        } catch (saveError) {
          logger.error({ orderId: order.id, err: saveError }, 'Failed to save match for order');
        }

        // Update Shopify order after successful match
        try {
          const matchDetails = `₴${firstMatch.amount} on ${new Date(
            firstMatch.transactionDateTime
          ).toLocaleDateString()}`;

          await updateOrderPaymentStatus(connections, order.id, order.shopId, {
            note: `🔍 Payment Verification Complete\nMatching transaction found: ${matchDetails}\nConfidence: ${Math.round(
              confidence
            )}%\n\nVerified at: ${new Date().toISOString()}`,
            markAsPaid: true,
          });
          // 🔥 Fix: Instantly update the local object so the UI JSON response shows 'paid' immediately
          // instead of returning the stale 'pending' status fetched at the start of the action.
          order.financialStatus = 'paid';

          // Create automatic check for verified payment (if enabled)
          if (autoCreateChecks) {
            try {
              // Find the corresponding orderData for this specific order
              const currentOrderData = orderData?.find(
                (od: any) =>
                  od.id === order.id ||
                  od.id === `gid://shopify/Order/${order.id}`
              );
              const checkResult = await createAutomaticCheck(
                order,
                connections,
                api,
                logger,
                currentOrderData
              );
              if (checkResult?.success) {
              } else if (checkResult?.skipped) {
              }
            } catch (checkError) {
              logger.error({ orderName: order.name, err: checkError }, 'Check creation error for order');
            }
          }
        } catch (shopifyError) {
          logger.error({ orderId: order.id, err: shopifyError }, 'Failed to update Shopify order');
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
            }

            // Check if skipped
            if (bankTransaction.checkSkipReason) {
              checkInfo.checkSkipped = true;
              checkInfo.checkSkipReason = bankTransaction.checkSkipReason;
            }
          } else {
          }
        } catch (err) {
          logger.error({ orderId: order.id, err }, 'Error fetching check info for order');
        }
      }

      results.push({
        orderId: order.id,
        orderName: order.name || '',
        orderAmount: orderAmount,
        orderDate: order.createdAt,
        financialStatus: order.financialStatus || '',
        matchCount: matches.length,
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
    }, logger, { orders_count: orders.length, transactions_count: transactions.length });

    logger.info({
      stage: 'verify_summary',
      orders_checked: orders.length,
      orders_matched: results.filter((r: any) => r.matchCount > 0).length,
      checks_created: results.filter((r: any) => r.checkIssued).length,
      checks_skipped: results.filter((r: any) => r.checkSkipped).length,
      total_duration_ms: Math.round(performance.now() - actionStart),
    }, 'Verify summary');

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
    logger.error({ err: error }, 'Error in verifyOrderPayments');
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
