import { BlockStack, Text } from '@shopify/ui-extensions-react/admin';
import { DEFAULT_PACKAGE_DETAILS } from '../constants';

/**
 * Package Details Display Component
 *
 * Displays all package details as constants (no user input):
 * - Weight: 1 kg
 * - Cost: 100 UAH
 * - Seats: 1
 * - Description: "Комп`ютерні аксесуари"
 * - Cargo Type: "Cargo"
 * - Payment Method: "Cash" (recipient pays)
 * - Service Type: "WarehouseWarehouse"
 *
 * @example
 * <PackageDetailsForm />
 */
export default function PackageDetailsForm() {
  return (
    <BlockStack>
      <Text fontWeight='bold'>Деталі відправлення</Text>

      {/* Display all constant values */}
      <Text>
        Вага: {DEFAULT_PACKAGE_DETAILS.WEIGHT} кг | Вартість:{' '}
        {DEFAULT_PACKAGE_DETAILS.COST} ₴ | Місць:{' '}
        {DEFAULT_PACKAGE_DETAILS.SEATS_AMOUNT}
      </Text>
      <Text>Опис: {DEFAULT_PACKAGE_DETAILS.DESCRIPTION}</Text>
      <Text>Тип вантажу: Вантаж</Text>
      <Text>Спосіб оплати: Готівка (платить одержувач)</Text>
      <Text>Тип доставки: Відділення → Відділення</Text>
    </BlockStack>
  );
}
