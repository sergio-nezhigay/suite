import { ActionOptions } from 'gadget-server';
import {
  EXCLUDED_PAYMENT_CODES,
  NOVA_POSHTA_ACCOUNT,
  extractPaymentCodeFromAccount,
} from '../utilities/fiscal/paymentConstants';
import { distributeAmount } from '../utilities/fiscal/receiptNames';

export const params = {
  transactionId: { type: 'string', required: true },
  amount: { type: 'number', required: true },
};

export const run: ActionRun = async ({ params, api, logger }) => {
  try {
    const { transactionId, amount } = params;

    if (!amount || amount <= 0) {
      throw new Error('Invalid amount for check preview');
    }

    // Fetch the bank transaction (prefer checking here first)
    const bankTransaction = await api.bankTransaction.findFirst({
      filter: { id: { equals: transactionId } },
      select: {
        id: true,
        amount: true,
        counterpartyAccount: true,
        counterpartyName: true,
        // NEW: Include payment matching fields
        checkIssuedAt: true,
        checkReceiptId: true,
        checkSkipReason: true,
      },
    });

    if (!bankTransaction) {
      return {
        success: false,
        error: 'Transaction not found',
      };
    }

    // Check if this is Nova Poshta account (excluded from checks)
    if (bankTransaction.counterpartyAccount === NOVA_POSHTA_ACCOUNT) {
      throw new Error('Check preview not allowed for Nova Poshta payments');
    }

    // Check if this payment code is excluded from checks
    const paymentCode = extractPaymentCodeFromAccount(
      bankTransaction.counterpartyAccount || ''
    );
    if (paymentCode && EXCLUDED_PAYMENT_CODES.includes(paymentCode)) {
      throw new Error(
        `Check preview not allowed for payment code ${paymentCode} (codes ${EXCLUDED_PAYMENT_CODES.join(
          ', '
        )} don't require checks)`
      );
    }

    // Check if check already issued (using bankTransaction only)
    if (bankTransaction.checkReceiptId || bankTransaction.checkIssuedAt) {
      return {
        success: false,
        error: 'Check already issued for this transaction',
        receiptId: bankTransaction.checkReceiptId,
        issuedAt: bankTransaction.checkIssuedAt,
      };
    }

    // Distribute amount across items
    const items = distributeAmount(amount, String(transactionId));

    // Calculate total for verification
    const calculatedTotal = items.reduce((sum, item) => sum + item.totalUAH, 0);

    // Verify total matches (allow 1 UAH rounding difference)
    if (Math.abs(calculatedTotal - amount) > 1) {
      throw new Error(
        `Total amount mismatch: expected ${amount} UAH, got ${calculatedTotal} UAH`
      );
    }

    return {
      success: true,
      transactionId,
      items: items.map((item, index) => ({
        code: String(index + 1).padStart(4, '0'), // "0001", "0002", etc.
        name: item.name,
        quantity: item.quantity,
        priceUAH: item.priceUAH,
        priceKopecks: Math.round(item.priceUAH * 100),
        totalUAH: item.totalUAH,
        totalKopecks: Math.round(item.totalUAH * 100),
      })),
      totalAmountUAH: calculatedTotal,
      totalAmountKopecks: Math.round(calculatedTotal * 100),
    };
  } catch (error) {
    logger.error({ error }, '[previewCheckForPayment] Error');
    throw error;
  }
};

export const options: ActionOptions = {
  actionType: 'custom',
};
