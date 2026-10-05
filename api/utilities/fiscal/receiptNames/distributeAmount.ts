import { assignReceiptNames, stableHash } from './assign';

export interface PaymentCheckItem {
  name: string;
  quantity: number;
  priceUAH: number;
  totalUAH: number;
}

// mulberry32: seeded so preview and issued check get identical prices
function seededRandom(seed: string): () => number {
  let state = stableHash(seed);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function splitPrices(totalAmountUAH: number, random: () => number): number[] {
  // If amount is 1000 UAH or less, use single item
  if (totalAmountUAH <= 1000) {
    return [totalAmountUAH];
  }

  // For amounts > 1000 UAH, split into multiple items with variable pricing
  // Price range: 300-900 UAH to look natural
  const minPrice = 300;
  const maxPrice = 900;
  const prices: number[] = [];
  let remainingAmount = totalAmountUAH;
  let iterationCount = 0;
  const MAX_ITERATIONS = 1000; // Safety limit to prevent infinite loops

  while (remainingAmount > 0) {
    iterationCount++;

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
      // Weighted random to prefer mid-range prices (450-700)
      const roll = random();
      if (roll < 0.2) {
        itemPrice = Math.floor(random() * (450 - minPrice + 1)) + minPrice;
      } else if (roll < 0.8) {
        itemPrice = Math.floor(random() * (700 - 450 + 1)) + 450;
      } else {
        itemPrice = Math.floor(random() * (maxPrice - 700 + 1)) + 700;
      }
    }

    // Round to nearest 10 for natural-looking prices
    itemPrice = Math.round(itemPrice / 10) * 10;

    // Prevent zero prices that cause infinite loops
    if (itemPrice === 0 && remainingAmount > 0) {
      itemPrice = 10;
    }

    itemPrice = Math.min(itemPrice, remainingAmount);

    if (itemPrice <= 0) {
      throw new Error(`Invalid itemPrice: ${itemPrice}. This would cause an infinite loop.`);
    }

    prices.push(itemPrice);
    remainingAmount -= itemPrice;
  }

  return prices;
}

/**
 * Splits a bank payment into check lines with distinct names from the catalog.
 * Deterministic per seed (transaction id), so preview equals the issued check.
 */
export function distributeAmount(totalAmountUAH: number, seed: string): PaymentCheckItem[] {
  const prices = splitPrices(totalAmountUAH, seededRandom(seed));
  const names = assignReceiptNames(
    prices.map((price, index) => ({ title: `payment-line-${index}`, price })),
    seed
  );

  return prices.map((price, index) => ({
    name: names[index],
    quantity: 1,
    priceUAH: price,
    totalUAH: price,
  }));
}
