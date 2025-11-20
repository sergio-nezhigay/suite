import { useState, useEffect, useMemo } from 'react';
import {
  BlockStack,
  Select,
  ProgressIndicator,
  Text,
  InlineStack,
  TextField,
} from '@shopify/ui-extensions-react/admin';
import { useWarehouseSearch } from '../hooks/useNovaPoshtaApi';
import type { WarehouseAutocompleteProps } from '../types';
import { sortWarehousesByNumber, filterWarehouses } from '../utils/warehouseUtils';

/**
 * Warehouse Autocomplete Component
 *
 * Loads warehouses for selected city with search filtering
 * - Fetches warehouses when city is selected
 * - Debounced loading (500ms)
 * - Search field to filter warehouses by number or address
 * - Sorts warehouses by number
 * - Displays filtered warehouses in dropdown
 * - Shows result count
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
  const [localSelectedRef, setLocalSelectedRef] = useState<string | undefined>(
    selectedWarehouseRef ?? undefined
  );
  const [warehouseSearchQuery, setWarehouseSearchQuery] = useState<string>('');
  const { warehouses, isLoading, error: searchError } = useWarehouseSearch(cityRef);

  // Sort and filter warehouses
  const sortedWarehouses = useMemo(
    () => sortWarehousesByNumber(warehouses),
    [warehouses]
  );

  const filteredWarehouses = useMemo(
    () => filterWarehouses(sortedWarehouses, warehouseSearchQuery),
    [sortedWarehouses, warehouseSearchQuery]
  );

  // Reset search when city changes
  useEffect(() => {
    setWarehouseSearchQuery('');
    setLocalSelectedRef(undefined);
  }, [cityRef]);

  // Auto-select if only one warehouse available (in filtered results)
  useEffect(() => {
    if (filteredWarehouses.length === 1 && !localSelectedRef) {
      const warehouse = filteredWarehouses[0];
      setLocalSelectedRef(warehouse.Ref);
      onWarehouseSelect(warehouse.Ref, warehouse.Description);
    } else if (filteredWarehouses.length === 0 && !warehouseSearchQuery) {
      setLocalSelectedRef(undefined);
    }
  }, [filteredWarehouses, localSelectedRef, onWarehouseSelect, warehouseSearchQuery]);

  // Handle warehouse selection
  const handleWarehouseChange = (warehouseRef: string) => {
    setLocalSelectedRef(warehouseRef);
    const selectedWarehouse = filteredWarehouses.find((w) => w.Ref === warehouseRef);
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
        <>
          <TextField
            label="Пошук відділення"
            value={warehouseSearchQuery}
            onChange={setWarehouseSearchQuery}
            placeholder="Номер або адреса (наприклад: 234 або Хрещатик)"
            disabled={disabled}
          />

          {filteredWarehouses.length > 0 && (
            <>
              <Text>Знайдено відділень: {filteredWarehouses.length}</Text>
              <Select
                label={label}
                options={filteredWarehouses.map((warehouse) => ({
                  value: warehouse.Ref,
                  label: warehouse.Description,
                }))}
                value={localSelectedRef}
                onChange={handleWarehouseChange}
                disabled={disabled}
                error={displayError}
              />
            </>
          )}

          {filteredWarehouses.length === 0 && warehouseSearchQuery && (
            <Text>Відділення не знайдено. Спробуйте інший запит.</Text>
          )}
        </>
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
