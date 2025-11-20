import type { NovaPoshtaWarehouse } from '../types';

/**
 * Extracts warehouse number from the Number field or Description
 * Examples:
 * - Number: "234" -> 234
 * - Description: "Відділення №234: вул. Хрещатик, 1" -> 234
 */
export function extractWarehouseNumber(warehouse: NovaPoshtaWarehouse): number {
  // Try Number field first
  if (warehouse.Number) {
    const num = parseInt(warehouse.Number, 10);
    if (!isNaN(num)) return num;
  }

  // Fallback: parse from Description
  if (warehouse.Description) {
    const match = warehouse.Description.match(/№\s*(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num)) return num;
    }
  }

  // If no number found, return high value to sort to end
  return 99999;
}

/**
 * Sorts warehouses by number in ascending order
 */
export function sortWarehousesByNumber(
  warehouses: NovaPoshtaWarehouse[]
): NovaPoshtaWarehouse[] {
  return [...warehouses].sort((a, b) => {
    const numA = extractWarehouseNumber(a);
    const numB = extractWarehouseNumber(b);
    return numA - numB;
  });
}

/**
 * Filters warehouses by search query
 * Matches against:
 * - Warehouse number (exact or starts with)
 * - Address/street in description
 */
export function filterWarehouses(
  warehouses: NovaPoshtaWarehouse[],
  searchQuery: string
): NovaPoshtaWarehouse[] {
  if (!searchQuery.trim()) {
    return warehouses;
  }

  const query = searchQuery.trim().toLowerCase();
  const isNumericQuery = /^\d+$/.test(query);

  return warehouses.filter((warehouse) => {
    // Match against warehouse number
    const warehouseNum = extractWarehouseNumber(warehouse);
    if (isNumericQuery) {
      // If user types only numbers, prioritize exact number match
      const numString = warehouseNum.toString();
      if (numString === query || numString.startsWith(query)) {
        return true;
      }
    }

    // Match against description (address/street)
    if (warehouse.Description) {
      const description = warehouse.Description.toLowerCase();
      if (description.includes(query)) {
        return true;
      }
    }

    // Match against ShortAddress if available
    if (warehouse.ShortAddress) {
      const shortAddress = warehouse.ShortAddress.toLowerCase();
      if (shortAddress.includes(query)) {
        return true;
      }
    }

    return false;
  });
}
