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

interface PreviewItem {
  name: string;
  quantity: number;
  priceUAH: number;
  totalUAH: number;
}

// Helper function to distribute amount across multiple items with variable pricing
// This is the same logic from previewCheckForPayment to ensure consistency
function distributeAmount(totalAmountUAH: number): PreviewItem[] {
  const productName = 'Перехідник HDMI to VGA';

  // If amount is 1000 UAH or less, use single item
  if (totalAmountUAH <= 1000) {
    return [
      {
        name: productName,
        quantity: 1,
        priceUAH: totalAmountUAH,
        totalUAH: totalAmountUAH,
      },
    ];
  }

  // For amounts > 1000 UAH, split into multiple items with variable pricing
  // Price range: 300-900 UAH to look natural
  const minPrice = 300;
  const maxPrice = 900;
  const items: PreviewItem[] = [];
  let remainingAmount = totalAmountUAH;

  console.log(
    '[issueCheckForPayment] Distributing amount:',
    totalAmountUAH,
    'UAH'
  );

  // Generate items until remaining amount is covered
  while (remainingAmount > 0) {
    let itemPrice: number;

    if (remainingAmount <= maxPrice) {
      // Last item: use exact remaining amount
      itemPrice = remainingAmount;
    } else if (remainingAmount <= maxPrice + minPrice) {
      // Split remaining into 2 items with similar prices
      itemPrice = Math.floor(remainingAmount / 2);
    } else {
      // Generate random price in range for natural distribution
      // Use weighted random to prefer mid-range prices (400-700)
      const random = Math.random();
      if (random < 0.2) {
        // 20% chance: lower range (300-450)
        itemPrice = Math.floor(Math.random() * (450 - minPrice + 1)) + minPrice;
      } else if (random < 0.8) {
        // 60% chance: mid range (450-700)
        itemPrice = Math.floor(Math.random() * (700 - 450 + 1)) + 450;
      } else {
        // 20% chance: higher range (700-900)
        itemPrice = Math.floor(Math.random() * (maxPrice - 700 + 1)) + 700;
      }
    }

    // Round to nearest 10 for natural-looking prices
    itemPrice = Math.round(itemPrice / 10) * 10;

    // Ensure we don't exceed remaining amount
    itemPrice = Math.min(itemPrice, remainingAmount);

    items.push({
      name: productName,
      quantity: 1,
      priceUAH: itemPrice,
      totalUAH: itemPrice,
    });

    remainingAmount -= itemPrice;
    console.log(
      '[issueCheckForPayment] Added item:',
      itemPrice,
      'UAH, remaining:',
      remainingAmount,
      'UAH'
    );
  }

  return items;
}

export const params = {
  transactionId: { type: 'string', required: true },
  amount: { type: 'number', required: true },
};

export const run: ActionRun = async ({ params, api, logger }) => {
  try {
    const { transactionId, amount } = params;

    console.log(
      '[issueCheckForPayment] Starting check issuance for transaction:',
      transactionId,
      'amount:',
      amount,
      'UAH'
    );

    if (!amount || amount <= 0) {
      throw new Error('Invalid amount for check issuance');
    }

    // Fetch the bank transaction to validate exclusions
    const bankTransaction = await api.bankTransaction.findFirst({
      filter: { id: { equals: transactionId } },
      select: {
        id: true,
        counterpartyAccount: true,
        counterpartyName: true,
      },
    });

    if (!bankTransaction) {
      console.error(
        '[issueCheckForPayment] Bank transaction not found:',
        transactionId
      );
      return {
        success: false,
        error: 'Bank transaction not found',
      };
    }

    // Check if this is Nova Poshta account (excluded from checks)
    if (bankTransaction.counterpartyAccount === NOVA_POSHTA_ACCOUNT) {
      console.log(
        '[issueCheckForPayment] Nova Poshta account detected - check not allowed'
      );
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
      console.log(
        '[issueCheckForPayment] Excluded payment code detected:',
        paymentCode
      );
      return {
        success: false,
        error: `Check issuance not allowed for payment code ${paymentCode} (codes ${EXCLUDED_PAYMENT_CODES.join(
          ', '
        )} don't require checks)`,
      };
    }

    // Get or create orderPaymentMatch record
    let paymentMatch = null;
    try {
      paymentMatch = await api.orderPaymentMatch.findFirst({
        filter: { bankTransactionId: { equals: transactionId } },
        select: {
          id: true,
          checkIssued: true,
          checkIssuedAt: true,
          checkReceiptId: true,
          checkFiscalCode: true,
          checkReceiptUrl: true,
          orderId: true, // Added to check if already linked to an order
        },
      });
    } catch (err: any) {
      // If the model was deleted, Gadget returns GGT_RECORD_NOT_FOUND (404).
      // Ignore that specific error so the action continues to use bankTransaction data.
      if (
        err?.code === 'GGT_RECORD_NOT_FOUND' ||
        err?.message?.includes('orderPaymentMatches')
      ) {
        console.warn(
          '[issueCheckForPayment] orderPaymentMatch model not available — skipping legacy checks'
        );
      } else {
        // Unexpected error — rethrow so it surfaces
        throw err;
      }
    }

    // If a match exists but is linked to a different order, prevent creation
    if (paymentMatch && paymentMatch.orderId) {
      console.log(
        '[issueCheckForPayment] Transaction already matched to order:',
        paymentMatch.orderId
      );
      return {
        success: false,
        error: 'Transaction already matched to another order',
      };
    }

    // Check if check already issued
    if (paymentMatch && paymentMatch.checkIssued) {
      console.log(
        '[issueCheckForPayment] Check already issued for this transaction'
      );
      return {
        success: false,
        error: 'Check already issued for this transaction',
        receiptId: paymentMatch.checkReceiptId,
        fiscalCode: paymentMatch.checkFiscalCode,
        receiptUrl: paymentMatch.checkReceiptUrl,
        issuedAt: paymentMatch.checkIssuedAt,
      };
    }

    // Location: Create payment match for manual check issuance
    // If no payment match exists, create one (dual-write note)
    if (!paymentMatch) {
      console.log(
        '[issueCheckForPayment] Creating new payment match record for transaction:',
        transactionId
      );
      try {
        paymentMatch = await api.orderPaymentMatch.create({
          bankTransactionId: transactionId,
          matchedBy: 'manual',
          verifiedAt: new Date(),
          notes: 'Created via manual check issuance from payments page',
          transactionAmount: amount,
        });
        console.log(
          '[issueCheckForPayment] Payment match created with ID:',
          paymentMatch.id
        );
      } catch (err: any) {
        // If the model was deleted, continue without creating a payment match
        if (
          err?.code === 'GGT_RECORD_NOT_FOUND' ||
          err?.message?.includes('orderPaymentMatches')
        ) {
          console.warn(
            '[issueCheckForPayment] orderPaymentMatch model not available — skipping creation'
          );
        } else {
          throw err;
        }
      }

      // Note: matchedOrderId is intentionally null here because manual
      // check issuance can happen before an order match. When the order is
      // matched later, verifyOrderPayments will set bankTransaction.matchedOrderId.
    }

    // Distribute amount across items
    const items = distributeAmount(amount);

    // Calculate total for verification
    const calculatedTotal = items.reduce((sum, item) => sum + item.totalUAH, 0);

    console.log(
      '[issueCheckForPayment] Generated',
      items.length,
      'items, total:',
      calculatedTotal,
      'UAH'
    );

    // Verify total matches (allow 1 UAH rounding difference)
    if (Math.abs(calculatedTotal - amount) > 1) {
      console.error(
        '[issueCheckForPayment] Total mismatch! Expected:',
        amount,
        'Got:',
        calculatedTotal
      );
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

    console.log(
      '[issueCheckForPayment] Receipt body prepared:',
      JSON.stringify(receiptBody, null, 2)
    );

    // Initialize Checkbox service
    const checkboxService = new CheckboxService();
    await checkboxService.signIn();
    await checkboxService.ensureShiftOpen();

    console.log(
      '[issueCheckForPayment] Calling Checkbox API to create receipt...'
    );

    // Create the sell receipt (with built-in retry logic)
    const receipt = await checkboxService.createSellReceipt(receiptBody);

    console.log(
      '[issueCheckForPayment] Receipt created successfully:',
      receipt.id
    );

    // Update payment match with check information
    const checkIssuedAt = new Date();
    if (paymentMatch) {
      try {
        const updateResult = await api.orderPaymentMatch.update(
          paymentMatch.id,
          {
            checkIssued: true,
            checkIssuedAt: checkIssuedAt,
            checkReceiptId: receipt.id,
            checkFiscalCode: receipt.fiscal_code || undefined,
            checkReceiptUrl: receipt.receipt_url || undefined,
          }
        );

        console.log(
          '[issueCheckForPayment] Payment match updated:',
          updateResult.id
        );
      } catch (err: any) {
        // If the model was deleted, continue without updating payment match
        if (
          err?.code === 'GGT_RECORD_NOT_FOUND' ||
          err?.message?.includes('orderPaymentMatches')
        ) {
          console.warn(
            '[issueCheckForPayment] orderPaymentMatch model not available — skipping update'
          );
        } else {
          throw err;
        }
      }
    }

    // Dual-write: also update the bank transaction
    // Use the fetched bankTransaction.id (already validated above) so the
    // update call receives a definite string instead of `string | undefined`.
    await api.bankTransaction.update(bankTransaction.id, {
      checkReceiptId: receipt.id,
      checkIssuedAt: checkIssuedAt,
    });

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
    console.error('[issueCheckForPayment] Error:', error);

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
