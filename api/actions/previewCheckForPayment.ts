import { ActionOptions } from 'gadget-server';

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

  console.log(
    '[previewCheckForPayment] Distributing amount:',
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
      '[previewCheckForPayment] Added item:',
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

export const run: ActionRun = async ({ params, logger }) => {
  try {
    const { transactionId, amount } = params;

    console.log(
      '[previewCheckForPayment] Previewing check for transaction:',
      transactionId,
      'amount:',
      amount,
      'UAH'
    );

    if (!amount || amount <= 0) {
      throw new Error('Invalid amount for check preview');
    }

    // Distribute amount across items
    const items = distributeAmount(amount);

    // Calculate total for verification
    const calculatedTotal = items.reduce((sum, item) => sum + item.totalUAH, 0);

    console.log(
      '[previewCheckForPayment] Generated',
      items.length,
      'items, total:',
      calculatedTotal,
      'UAH'
    );

    // Verify total matches (allow 1 UAH rounding difference)
    if (Math.abs(calculatedTotal - amount) > 1) {
      console.error(
        '[previewCheckForPayment] Total mismatch! Expected:',
        amount,
        'Got:',
        calculatedTotal
      );
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
    console.error('[previewCheckForPayment] Error:', error);
    throw error;
  }
};

export const options: ActionOptions = {
  actionType: 'custom',
};
