import { useState, useEffect } from 'react';
import {
  BlockStack,
  Select,
  ProgressIndicator,
  Text,
  InlineStack,
} from '@shopify/ui-extensions-react/admin';
import { useWarehouseSearch } from '../hooks/useNovaPoshtaApi';
import type { WarehouseAutocompleteProps } from '../types';

/**
 * Warehouse Autocomplete Component
 *
 * Loads warehouses for selected city with debouncing
 * - Fetches warehouses when city is selected
 * - Debounced loading (500ms)
 * - Displays warehouses in dropdown
 * - Auto-selects if only one warehouse available
 *
 * @example
 * <WarehouseAutocomplete
 *   label="Відділення"
 *   cityRef={selectedCityRef}
 *   selectedWarehouseRef={selectedWarehouseRef}
 *   onWarehouseSelect={(ref, description) => { ... }}
 * />
 */
export default function WarehouseAutocomplete({
  label,
  cityRef,
  selectedWarehouseRef,
  onWarehouseSelect,
  error,
  disabled = false,
}: WarehouseAutocompleteProps) {
  const [localSelectedRef, setLocalSelectedRef] = useState<string | null>(
    selectedWarehouseRef
  );
  const { warehouses, isLoading, error: searchError } = useWarehouseSearch(cityRef);

  // Auto-select if only one warehouse available
  useEffect(() => {
    if (warehouses.length === 1 && !localSelectedRef) {
      const warehouse = warehouses[0];
      setLocalSelectedRef(warehouse.Ref);
      onWarehouseSelect(warehouse.Ref, warehouse.Description);
    } else if (warehouses.length === 0) {
      setLocalSelectedRef(null);
    }
  }, [warehouses, localSelectedRef, onWarehouseSelect]);

  // Handle warehouse selection
  const handleWarehouseChange = (warehouseRef: string) => {
    setLocalSelectedRef(warehouseRef);
    const selectedWarehouse = warehouses.find((w) => w.Ref === warehouseRef);
    if (selectedWarehouse) {
      onWarehouseSelect(warehouseRef, selectedWarehouse.Description);
    }
  };

  // Show message if no city selected
  if (!cityRef) {
    return (
      <BlockStack>
        <Text>{label}</Text>
        <Text>
          Спочатку оберіть місто
        </Text>
      </BlockStack>
    );
  }

  const displayError = error || searchError;

  return (
    <BlockStack>
      {isLoading && (
        <InlineStack inlineAlignment="start">
          <ProgressIndicator size="small-100" />
          <Text>Завантаження відділень...</Text>
        </InlineStack>
      )}

      {!isLoading && warehouses.length > 0 && (
        <Select
          label={label}
          options={warehouses.map((warehouse) => ({
            value: warehouse.Ref,
            label: warehouse.Description,
          }))}
          value={localSelectedRef || ''}
          onChange={handleWarehouseChange}
          disabled={disabled}
          error={displayError}
        />
      )}

      {!isLoading && warehouses.length === 0 && !searchError && (
        <Text>Відділення не знайдено для цього міста</Text>
      )}

      {displayError && !isLoading && (
        <Text>{displayError}</Text>
      )}
    </BlockStack>
  );
}
