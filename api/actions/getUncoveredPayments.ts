import { ActionOptions } from 'gadget-server';
import { EXCLUDED_PAYMENT_CODES, NOVA_POSHTA_ACCOUNT } from '../utilities/fiscal/paymentConstants';

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
    console.log('[getUncoveredPayments] Starting to fetch uncovered payments...');

    // Calculate date 7 days ago
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    console.log('[getUncoveredPayments] Fetching transactions since:', sevenDaysAgo.toISOString());

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

    console.log('[getUncoveredPayments] Found total income transactions:', allTransactions.length);

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

    console.log(`[getUncoveredPayments] Transactions requiring checks (excluding codes ${EXCLUDED_PAYMENT_CODES.join(', ')} and Nova Poshta):`, filteredTransactions.length);

    // For each filtered transaction, check if it has a check (prefer bankTransaction, fallback to orderPaymentMatch)
    const uncoveredPayments = [];

    // First, fetch payment matches for fallback (old data)
    const transactionIds = filteredTransactions.map((t) => t.id);
    const allPaymentMatches = await api.orderPaymentMatch.findMany({
      filter: {
        bankTransactionId: { in: transactionIds },
      },
      select: {
        id: true,
        bankTransactionId: true,
        checkIssued: true,
        checkSkipped: true,
        checkReceiptId: true,
        orderId: true,
      },
      first: 250,
    });

    // Build a Map for quick lookups: bankTransactionId -> paymentMatch
    const paymentMatchMap = new Map();
    for (const match of allPaymentMatches) {
      paymentMatchMap.set(match.bankTransactionId, match);
    }

    console.log(
      '[getUncoveredPayments] Found payment matches (fallback):',
      allPaymentMatches.length
    );

    for (const transaction of filteredTransactions) {
      // PREFER: Check bankTransaction fields first (new data)
      const hasCheckInTransaction =
        transaction.checkReceiptId || transaction.checkIssuedAt;
      const hasSkipInTransaction = transaction.checkSkipReason;

      // FALLBACK: Check orderPaymentMatch (old data)
      const paymentMatch = paymentMatchMap.get(transaction.id);
      const hasCheckInMatch = paymentMatch && paymentMatch.checkIssued;
      const hasSkipInMatch = paymentMatch && paymentMatch.checkSkipped;

      // Determine if payment needs check
      const hasCheck = hasCheckInTransaction || hasCheckInMatch;
      const isSkipped = hasSkipInTransaction || hasSkipInMatch;

      // Only include if no check and not skipped
      const shouldInclude = !hasCheck && !isSkipped;

      if (shouldInclude) {
        // Skip transactions without a valid date
        if (!transaction.transactionDateTime) {
          console.log('[getUncoveredPayments] Skipping transaction without date:', transaction.id);
          continue;
        }

        // Skip transactions without a valid amount
        if (!transaction.amount || transaction.amount <= 0) {
          console.log('[getUncoveredPayments] Skipping transaction without valid amount:', transaction.id, transaction.amount);
          continue;
        }

        const paymentCode = extractPaymentCodeFromAccount(transaction.counterpartyAccount || '');
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
          hasPaymentMatch: !!paymentMatch,
          paymentMatchId: paymentMatch?.id || null,
        });
      } else {
        console.log(
          `[getUncoveredPayments] Skipping transaction ${transaction.id}: ` +
            `hasCheck=${hasCheck} (txn=${hasCheckInTransaction}, match=${hasCheckInMatch}), ` +
            `isSkipped=${isSkipped} (txn=${hasSkipInTransaction}, match=${hasSkipInMatch})`
        );
      }
    }

    console.log('[getUncoveredPayments] Uncovered payments found:', uncoveredPayments.length);

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
    console.error('[getUncoveredPayments] Error:', error);
    throw error;
  }
};

export const options: ActionOptions = {
  actionType: 'custom',
};
