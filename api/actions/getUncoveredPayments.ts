import { ActionOptions } from 'gadget-server';
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

export const run: ActionRun = async ({ api, logger }) => {
  try {
    // Calculate date 7 days ago
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    // Fetch all income transactions from last 7 days
    const allTransactions = await api.bankTransaction.findMany({
      filter: {
        transactionDateTime: { greaterThan: sevenDaysAgo },
        type: { equals: 'income' },
      },
      select: {
        id: true,
        amount: true,
        counterpartyAccount: true,
        counterpartyName: true,
        transactionDateTime: true,
        description: true,
        externalId: true,
        // NEW: Include payment matching fields
        matchedOrderId: true,
        checkIssuedAt: true,
        checkReceiptId: true,
        checkSkipReason: true,
      },
      sort: { transactionDateTime: 'Descending' },
      first: 250,
    });
    // Filter transactions - exclude payments with codes that don't need checks
    const filteredTransactions = allTransactions.filter((transaction) => {
      const counterpartyAccount = transaction.counterpartyAccount || '';

      // Exclude Nova Poshta account
      if (counterpartyAccount === NOVA_POSHTA_ACCOUNT) {
        return false;
      }

      const paymentCode = extractPaymentCodeFromAccount(counterpartyAccount);
      // Include transactions where code is NOT in excluded list
      return paymentCode && !EXCLUDED_PAYMENT_CODES.includes(paymentCode);
    });
    // Check each transaction using only bankTransaction fields
    const uncoveredPayments = [];

    for (const transaction of filteredTransactions) {
      // Check if payment has a check or is skipped (using bankTransaction fields only)
      const hasCheck = !!transaction.checkReceiptId || !!transaction.checkIssuedAt;
      const isSkipped = !!transaction.checkSkipReason;

      // Only include if no check and not skipped
      if (!hasCheck && !isSkipped) {
        // Skip transactions without a valid date
        if (!transaction.transactionDateTime) {
          continue;
        }

        // Skip transactions without a valid amount
        if (!transaction.amount || transaction.amount <= 0) {
          continue;
        }

        const paymentCode = extractPaymentCodeFromAccount(
          transaction.counterpartyAccount || ''
        );
        const transactionDate = new Date(transaction.transactionDateTime);
        const now = new Date();
        const daysAgo = Math.floor(
          (now.getTime() - transactionDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        uncoveredPayments.push({
          id: transaction.id,
          transactionId: transaction.externalId || '',
          date: transactionDate.toISOString().split('T')[0], // YYYY-MM-DD format
          amount: transaction.amount,
          counterpartyName: transaction.counterpartyName || 'Unknown',
          counterpartyAccount: transaction.counterpartyAccount || '',
          accountCode: paymentCode,
          daysAgo,
          description: transaction.description || '',
        });
      } else {
      }
    }
    return {
      success: true,
      payments: uncoveredPayments,
      total: uncoveredPayments.length,
      excludedCodes: EXCLUDED_PAYMENT_CODES,
      dateRange: {
        from: sevenDaysAgo.toISOString(),
        to: new Date().toISOString(),
      },
    };
  } catch (error) {
    logger.error({ err: error }, '[getUncoveredPayments] Error');
    throw error;
  }
};

export const options: ActionOptions = {
  actionType: 'custom',
};
