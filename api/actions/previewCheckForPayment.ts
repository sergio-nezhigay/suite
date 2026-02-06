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

interface PreviewItem {
  name: string;
  quantity: number;
  priceUAH: number;
  totalUAH: number;
}

// Helper function to distribute amount across multiple items with variable pricing
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
  let iterationCount = 0;
  const MAX_ITERATIONS = 1000; // Safety limit to prevent infinite loops

  // Generate items until remaining amount is covered
  while (remainingAmount > 0) {
    iterationCount++;

    // Safety check to prevent infinite loops
    if (iterationCount > MAX_ITERATIONS) {
      throw new Error(
        `Distribution loop exceeded ${MAX_ITERATIONS} iterations. Remaining: ${remainingAmount} UAH. This indicates an infinite loop bug.`
      );
    }

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

    // CRITICAL FIX: Prevent zero prices that cause infinite loops
    if (itemPrice === 0 && remainingAmount > 0) {
      itemPrice = 10; // Minimum price of 10 UAH
    }

    // Ensure we don't exceed remaining amount
    itemPrice = Math.min(itemPrice, remainingAmount);

    // Final safety check
    if (itemPrice <= 0) {
      throw new Error(
        `Invalid itemPrice: ${itemPrice}. This would cause an infinite loop.`
      );
    }

    items.push({
      name: productName,
      quantity: 1,
      priceUAH: itemPrice,
      totalUAH: itemPrice,
    });

    remainingAmount -= itemPrice;
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
    const items = distributeAmount(amount);

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
