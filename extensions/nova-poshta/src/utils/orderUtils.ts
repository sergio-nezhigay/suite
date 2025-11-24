import type { OrderDetails } from '../../../shared/shopifyOperations';

/**
 * Calculates the total cost of unfulfilled line items
 * Uses discounted unit price × unfulfilled quantity for each item
 * Returns the sum as a string formatted for Nova Poshta API
 *
 * @param lineItems - Array of line items from order details
 * @returns Total cost as string (e.g., "1250.50") or "0" if no items
 *
 * @example
 * const cost = calculateUnfulfilledItemsCost(orderDetails.lineItems);
 * // Returns: "1250.50"
 */
export function calculateUnfulfilledItemsCost(
  lineItems?: NonNullable<OrderDetails>['lineItems']
): string {
  if (!lineItems || lineItems.length === 0) {
    return '0';
  }

  const totalCost = lineItems.reduce((sum, lineItem) => {
    const price = parseFloat(lineItem.discountedUnitPriceSet.shopMoney.amount);
    const quantity = lineItem.unfulfilledQuantity;

    console.log('DEBUG: Processing Item:', {
      title: lineItem.title,
      price: price,
      quantity: quantity,
      unfulfilledQuantity: lineItem.unfulfilledQuantity,
    });

    // Only count items with unfulfilled quantity
    if (quantity > 0 && !isNaN(price)) {
      return sum + price * quantity;
    }

    return sum;
  }, 0);

  // Round to 2 decimal places and return as string
  return totalCost.toFixed(2);
}

/**
 * Formats cost for display in Ukrainian format
 * @param cost - Cost as string
 * @returns Formatted string with currency (e.g., "1 250.50 грн")
 */
export function formatCostForDisplay(cost: string): string {
  const numericCost = parseFloat(cost);

  if (isNaN(numericCost)) {
    return '0 грн';
  }

  // Format with space as thousands separator
  const formatted = numericCost.toLocaleString('uk-UA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${formatted} грн`;
}
