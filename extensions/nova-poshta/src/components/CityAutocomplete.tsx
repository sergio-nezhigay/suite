import { useState, useEffect } from 'react';
import {
  BlockStack,
  TextField,
  Select,
  ProgressIndicator,
  Text,
  InlineStack,
} from '@shopify/ui-extensions-react/admin';
import { useCitySearch } from '../hooks/useNovaPoshtaApi';
import type { CityAutocompleteProps, NovaPoshtaCity } from '../types';

/**
 * City Autocomplete Component
 *
 * Provides debounced city search with dropdown selection
 * - User types city name
 * - Debounced search (500ms)
 * - Display matching cities in dropdown
 * - Auto-select first result
 *
 * @example
 * <CityAutocomplete
 *   label="Місто"
 *   value={citySearchQuery}
 *   onChange={setCitySearchQuery}
 *   onCitySelect={(ref, name) => { ... }}
 * />
 */
export default function CityAutocomplete({
  label,
  value,
  onChange,
  onCitySelect,
  error,
  disabled = false,
  placeholder = 'Почніть вводити назву міста...',
}: CityAutocompleteProps) {
  const [selectedCityRef, setSelectedCityRef] = useState<string | null>(null);
  const { cities, isLoading, error: searchError } = useCitySearch(value, 2);

  // Auto-select first city when results arrive
  useEffect(() => {
    if (cities.length > 0 && !selectedCityRef) {
      const firstCity = cities[0];
      setSelectedCityRef(firstCity.Ref);
      onCitySelect(firstCity.Ref, firstCity.Description);
    } else if (cities.length === 0) {
      setSelectedCityRef(null);
    }
  }, [cities, selectedCityRef, onCitySelect]);

  // Handle city selection from dropdown
  const handleCityChange = (cityRef: string) => {
    setSelectedCityRef(cityRef);
    const selectedCity = cities.find((c) => c.Ref === cityRef);
    if (selectedCity) {
      onCitySelect(cityRef, selectedCity.Description);
    }
  };

  // Format city label with region if it's a single word
  const formatCityLabel = (city: NovaPoshtaCity): string => {
    const isSingleWord = city.Description.trim().split(/\s+/).length === 1;
    if (isSingleWord && city.AreaDescription) {
      return `${city.Description} (${city.AreaDescription} обл.)`;
    }
    return city.Description;
  };

  const displayError = error || searchError;

  return (
    <BlockStack>
      <TextField
        label={label}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        error={value.length > 0 && value.length < 2 ? 'Мінімум 2 символи' : displayError}
      />

      {isLoading && (
        <InlineStack inlineAlignment="start">
          <ProgressIndicator size="small-100" />
          <Text>Пошук міст...</Text>
        </InlineStack>
      )}

      {!isLoading && cities.length > 0 && (
        <Select
          label="Оберіть місто"
          options={cities.map((city) => ({
            value: city.Ref,
            label: formatCityLabel(city),
          }))}
          onChange={handleCityChange}
          value={selectedCityRef || ''}
        />
      )}

      {!isLoading && value.trim().length >= 2 && cities.length === 0 && !searchError && (
        <Text>Міста не знайдено</Text>
      )}
    </BlockStack>
  );
}
