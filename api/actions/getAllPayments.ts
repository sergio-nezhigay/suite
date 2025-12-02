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

// Status determination function with priority order
function determinePaymentStatus(transaction: any): {
  status: string;
  statusReason: string;
  statusBadgeTone?: 'success' | 'warning' | 'info' | 'critical' | 'attention';
  canIssueCheck: boolean;
} {
  const counterpartyAccount = transaction.counterpartyAccount || '';

  // Priority 1: Check if check already issued
  if (transaction.checkReceiptId || transaction.checkIssuedAt) {
    return {
      status: 'check_issued',
      statusReason: '✅ Check Issued',
      statusBadgeTone: 'success',
      canIssueCheck: false,
    };
  }

  // Priority 2: Check if Nova Poshta account
  if (counterpartyAccount === NOVA_POSHTA_ACCOUNT) {
    return {
      status: 'nova_poshta',
      statusReason: '🚚 Nova Poshta',
      statusBadgeTone: 'info',
      canIssueCheck: false,
    };
  }

  // Priority 3: Check if excluded payment code
  const paymentCode = extractPaymentCodeFromAccount(counterpartyAccount);
  if (paymentCode && EXCLUDED_PAYMENT_CODES.includes(paymentCode)) {
    return {
      status: 'excluded_code',
      statusReason: `⏭️ Code ${paymentCode}`,
      statusBadgeTone: 'warning',
      canIssueCheck: false,
    };
  }

  // Priority 4: Check if skipped
  if (transaction.checkSkipReason) {
    return {
      status: 'skipped',
      statusReason: '⏸️ Skipped',
      statusBadgeTone: 'attention',
      canIssueCheck: false,
    };
  }

  // Priority 5: Check if matched to order
  if (transaction.matchedOrderId) {
    return {
      status: 'matched_order',
      statusReason: '📦 Matched',
      statusBadgeTone: 'info',
      canIssueCheck: true, // Can still issue check for matched orders
    };
  }

  // Priority 6: Otherwise needs check
  return {
    status: 'needs_check',
    statusReason: '⏳ Needs Check',
    statusBadgeTone: 'critical',
    canIssueCheck: true,
  };
}

export const run: ActionRun = async ({ api, logger }) => {
  try {
    console.log('[getAllPayments] Starting to fetch all payments...');

    // Calculate date 7 days ago
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    console.log(
      '[getAllPayments] Fetching transactions since:',
      sevenDaysAgo.toISOString()
    );

    // Fetch all income transactions from last 7 days (filter out amounts > 10,000 UAH)
    const allTransactions = await api.bankTransaction.findMany({
      filter: {
        transactionDateTime: { greaterThan: sevenDaysAgo },
        type: { equals: 'income' },
        amount: { lessThanOrEqual: 10000 },
      },
      select: {
        id: true,
        amount: true,
        counterpartyAccount: true,
        counterpartyName: true,
        transactionDateTime: true,
        description: true,
        externalId: true,
        // Payment matching and check fields
        matchedOrderId: true,
        checkIssuedAt: true,
        checkReceiptId: true,
        checkSkipReason: true,
      },
      sort: { transactionDateTime: 'Descending' },
      first: 250,
    });

    console.log(
      '[getAllPayments] Found total income transactions:',
      allTransactions.length
    );

    // Process all transactions and add status
    const allPayments = [];
    const summary = {
      checkIssued: 0,
      excludedCode: 0,
      novaPostha: 0,
      matchedOrder: 0,
      needsCheck: 0,
      skipped: 0,
    };

    for (const transaction of allTransactions) {
      // Skip transactions without valid date
      if (!transaction.transactionDateTime) {
        console.log(
          '[getAllPayments] Skipping transaction without date:',
          transaction.id
        );
        continue;
      }

      // Skip transactions without valid amount
      if (!transaction.amount || transaction.amount <= 0) {
        console.log(
          '[getAllPayments] Skipping transaction without valid amount:',
          transaction.id,
          transaction.amount
        );
        continue;
      }

      // Determine status for this payment
      const statusInfo = determinePaymentStatus(transaction);

      // Update summary counts
      if (statusInfo.status === 'check_issued') summary.checkIssued++;
      else if (statusInfo.status === 'excluded_code') summary.excludedCode++;
      else if (statusInfo.status === 'nova_poshta') summary.novaPostha++;
      else if (statusInfo.status === 'matched_order') summary.matchedOrder++;
      else if (statusInfo.status === 'needs_check') summary.needsCheck++;
      else if (statusInfo.status === 'skipped') summary.skipped++;

      const paymentCode = extractPaymentCodeFromAccount(
        transaction.counterpartyAccount || ''
      );
      const transactionDate = new Date(transaction.transactionDateTime);
      const now = new Date();
      const daysAgo = Math.floor(
        (now.getTime() - transactionDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      allPayments.push({
        id: transaction.id,
        transactionId: transaction.externalId || '',
        date: transactionDate.toISOString().split('T')[0], // YYYY-MM-DD format
        amount: transaction.amount,
        counterpartyName: transaction.counterpartyName || 'Unknown',
        counterpartyAccount: transaction.counterpartyAccount || '',
        accountCode: paymentCode || 'N/A',
        daysAgo,
        description: transaction.description || '',
        // Status fields
        status: statusInfo.status,
        statusReason: statusInfo.statusReason,
        statusBadgeTone: statusInfo.statusBadgeTone,
        canIssueCheck: statusInfo.canIssueCheck,
        // Optional fields for reference
        matchedOrderId: transaction.matchedOrderId || null,
        checkReceiptId: transaction.checkReceiptId || null,
        checkIssuedAt: transaction.checkIssuedAt
          ? transaction.checkIssuedAt.toISOString()
          : null,
      });
    }

    console.log('[getAllPayments] Total payments to display:', allPayments.length);
    console.log('[getAllPayments] Summary:', summary);

    return {
      success: true,
      payments: allPayments,
      total: allPayments.length,
      summary,
      dateRange: {
        from: sevenDaysAgo.toISOString(),
        to: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('[getAllPayments] Error:', error);
    throw error;
  }
};

export const options: ActionOptions = {
  actionType: 'custom',
};
