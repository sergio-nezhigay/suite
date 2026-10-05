import { ActionOptions } from 'gadget-server';
import { CheckboxService } from '../utilities/fiscal/checkboxService';
import {
  CheckboxSellReceiptBody,
  CheckboxGood,
  CheckboxCashlessPayment,
} from '../utilities/fiscal/checkboxTypes';
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
  const startTime = Date.now();

  try {
    const { transactionId, amount } = params;

    logger.info(
      { transactionId, amount },
      '[issueCheckForPayment] Starting check issuance'
    );

    if (!amount || amount <= 0) {
      throw new Error('Invalid amount for check issuance');
    }

    // Fetch the bank transaction to validate exclusions and check status
    const bankTransaction = await api.bankTransaction.findFirst({
      filter: { id: { equals: transactionId } },
      select: {
        id: true,
        counterpartyAccount: true,
        counterpartyName: true,
        matchedOrderId: true,
        checkIssuedAt: true,
        checkReceiptId: true,
        checkSkipReason: true,
      },
    });

    if (!bankTransaction) {
      logger.error(
        { transactionId },
        '[issueCheckForPayment] Bank transaction not found'
      );
      return {
        success: false,
        error: 'Bank transaction not found',
      };
    }

    // Check if this is Nova Poshta account (excluded from checks)
    if (bankTransaction.counterpartyAccount === NOVA_POSHTA_ACCOUNT) {
      return {
        success: false,
        error: 'Check issuance not allowed for Nova Poshta payments',
      };
    }

    // Check if this payment code is excluded from checks
    const paymentCode = extractPaymentCodeFromAccount(
      bankTransaction.counterpartyAccount || ''
    );
    if (paymentCode && EXCLUDED_PAYMENT_CODES.includes(paymentCode)) {
      return {
        success: false,
        error: `Check issuance not allowed for payment code ${paymentCode} (codes ${EXCLUDED_PAYMENT_CODES.join(
          ', '
        )} don't require checks)`,
      };
    }

    // Check if transaction already matched to an order
    if (bankTransaction.matchedOrderId) {
      return {
        success: false,
        error: 'Transaction already matched to another order',
      };
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

    // Build CheckboxSellReceiptBody
    const goods: CheckboxGood[] = items.map((item, index) => ({
      good: {
        code: String(index + 1).padStart(4, '0'), // "0001", "0002", etc.
        name: item.name,
        price: Math.round(item.priceUAH * 100), // Convert UAH to kopecks
      },
      quantity: 1000, // 1000 = 1 item in Checkbox API
      is_return: false,
      discounts: [],
    }));

    const payment: CheckboxCashlessPayment = {
      type: 'CASHLESS',
      value: Math.round(calculatedTotal * 100), // Convert UAH to kopecks
    };

    const receiptBody: CheckboxSellReceiptBody = {
      goods,
      payments: [payment],
      discounts: [],
    };

    // Initialize Checkbox service
    const checkboxService = new CheckboxService(logger);
    await checkboxService.signIn();
    await checkboxService.ensureShiftOpen();

    // Create the sell receipt (with built-in retry logic)
    const receipt = await checkboxService.createSellReceipt(receiptBody);

    // Update bank transaction with check information
    const checkIssuedAt = new Date();
    await api.bankTransaction.update(bankTransaction.id, {
      checkReceiptId: receipt.id,
      checkIssuedAt: checkIssuedAt,
    });

    const executionTimeMs = Date.now() - startTime;

    logger.info(
      {
        transactionId: bankTransaction.id,
        receiptId: receipt.id,
        fiscalCode: receipt.fiscal_code,
        itemsCount: items.length,
        executionTimeMs,
      },
      '[issueCheckForPayment] Check issued successfully'
    );

    return {
      success: true,
      receiptId: receipt.id,
      fiscalCode: receipt.fiscal_code,
      receiptUrl: receipt.receipt_url,
      issuedAt: checkIssuedAt,
      itemsCount: items.length,
      totalAmount: calculatedTotal,
    };
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;

    logger.error(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined,
        transactionId: params.transactionId,
        amount: params.amount,
        executionTimeMs,
      },
      '[issueCheckForPayment] Error issuing check'
    );

    // Return detailed error information
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};

export const options: ActionOptions = {
  actionType: 'custom',
};
