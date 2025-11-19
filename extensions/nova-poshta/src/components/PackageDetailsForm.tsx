// React import not needed for functional components in modern React
import {
  BlockStack,
  TextField,
  Select,
  Text,
} from '@shopify/ui-extensions-react/admin';
import type { PackageDetailsFormProps } from '../types';

/**
 * Package Details Form Component
 *
 * Form inputs for package/cargo details:
 * - Weight (kg)
 * - Declared cost (UAH)
 * - Number of seats/packages
 * - Description
 * - Cargo type
 * - Payment method
 * - Service type
 *
 * @example
 * <PackageDetailsForm
 *   packageDetails={details}
 *   onPackageDetailsChange={(updates) => setDetails({ ...details, ...updates })}
 * />
 */
export default function PackageDetailsForm({
  packageDetails,
  onPackageDetailsChange,
  errors = {},
  disabled = false,
}: PackageDetailsFormProps) {
  return (
    <BlockStack>
      <Text fontWeight="bold">Деталі відправлення</Text>

      {/* Weight */}
      <TextField
        label="Вага (кг)"
        value={packageDetails.weight}
        onChange={(value) => onPackageDetailsChange({ weight: value })}
        error={errors.weight}
        disabled={disabled}
        placeholder="1.0"
      />

      {/* Declared Cost */}
      <TextField
        label="Оголошена вартість (₴)"
        value={packageDetails.cost}
        onChange={(value) => onPackageDetailsChange({ cost: value })}
        error={errors.cost}
        disabled={disabled}
        placeholder="100"
      />

      {/* Seats Amount */}
      <TextField
        label="Кількість місць"
        value={packageDetails.seatsAmount}
        onChange={(value) => onPackageDetailsChange({ seatsAmount: value })}
        error={errors.seatsAmount}
        disabled={disabled}
        placeholder="1"
      />

      {/* Description */}
      <TextField
        label="Опис відправлення"
        value={packageDetails.description}
        onChange={(value) => onPackageDetailsChange({ description: value })}
        error={errors.description}
        disabled={disabled}
        placeholder="Інтернет-замовлення"
      />

      {/* Cargo Type */}
      <Select
        label="Тип вантажу"
        options={[
          { value: 'Cargo', label: 'Вантаж' },
          { value: 'Documents', label: 'Документи' },
          { value: 'Parcel', label: 'Посилка' },
          { value: 'TiresWheels', label: 'Шини і диски' },
          { value: 'Pallet', label: 'Палета' },
        ]}
        value={packageDetails.cargoType}
        onChange={(value) => onPackageDetailsChange({ cargoType: value })}
        disabled={disabled}
      />

      {/* Payment Method */}
      <Select
        label="Спосіб оплати"
        options={[
          { value: 'Cash', label: 'Готівка (платить одержувач)' },
          { value: 'NonCash', label: 'Безготівковий (платить відправник)' },
        ]}
        value={packageDetails.paymentMethod}
        onChange={(value) => onPackageDetailsChange({ paymentMethod: value })}
        disabled={disabled}
      />

      {/* Service Type */}
      <Select
        label="Тип доставки"
        options={[
          { value: 'WarehouseWarehouse', label: 'Відділення → Відділення' },
          { value: 'WarehouseDoors', label: 'Відділення → Адреса' },
          { value: 'DoorsWarehouse', label: 'Адреса → Відділення' },
          { value: 'DoorsDoors', label: 'Адреса → Адреса' },
        ]}
        value={packageDetails.serviceType}
        onChange={(value) => onPackageDetailsChange({ serviceType: value })}
        disabled={disabled}
      />
    </BlockStack>
  );
}
