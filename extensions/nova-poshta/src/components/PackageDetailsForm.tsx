import { BlockStack, Text } from '@shopify/ui-extensions-react/admin';
import { DEFAULT_PACKAGE_DETAILS } from '../constants';

/**
 * Package Details Display Component
 *
 * Displays all package details:
 * - Weight: 0.3 kg (default)
 * - Cost: Calculated from unfulfilled order items
 * - Seats: 1 (default)
 * - Description: "Комп`ютерні аксесуари" (default)
 * - Cargo Type: "Cargo" (default)
 * - Payment Method: "Cash" - recipient pays (default)
 * - Service Type: "WarehouseWarehouse" (default)
 *
 * @example
 * <PackageDetailsForm cost="1250.50" />
 */
export default function PackageDetailsForm({ cost }: { cost: string }) {
  return (
    <BlockStack>
      <Text fontWeight='bold'>Деталі відправлення</Text>

      {/* Display package details with calculated cost */}
      <Text>
        Вага: {DEFAULT_PACKAGE_DETAILS.WEIGHT} кг | Вартість: {cost} ₴ | Місць:{' '}
        {DEFAULT_PACKAGE_DETAILS.SEATS_AMOUNT}
      </Text>
      <Text>Опис: {DEFAULT_PACKAGE_DETAILS.DESCRIPTION}</Text>
      <Text>Тип вантажу: Вантаж</Text>
      <Text>Спосіб оплати: Готівка (платить одержувач)</Text>
      <Text>Тип доставки: Відділення → Відділення</Text>
    </BlockStack>
  );
}
