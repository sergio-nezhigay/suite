import { useEffect, useState } from 'react';
import {
  render,
  BlockStack,
  InlineStack,
  Section,
  TextField,
  Select,
  Text,
} from '@shopify/ui-extensions-react/admin';

interface City {
  Ref: string;
  Description: string;
}

import { SHOPIFY_APP_URL } from '../../shared/data';
import { BestWarehouse } from '../../shared/shopifyOperations';

interface WarehouseNP {
  Ref: string;
  Description: string;
}

export default function NovaPoshtaSelector({
  bestWarehouse,
}: {
  bestWarehouse: BestWarehouse;
}) {
  const [cityQuery, setCityQuery] = useState(
    bestWarehouse.cityDescription.toLowerCase()
  );
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCity, setSelectedCity] = useState<string | null>(
    bestWarehouse.cityRef
  );

  const [warehouses, setWarehouses] = useState<WarehouseNP[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string | null>(
    bestWarehouse.warehouseRef
  );

  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);

  // Fetch cities based on query
  useEffect(() => {
    if (cityQuery.trim() === '') {
      setCities([]);
      return;
    }

    const fetchCities = async () => {
      setLoadingCities(true);
      try {
        const payload = {
          modelName: 'Address',
          calledMethod: 'getCities',
          methodProperties: {
            FindByString: cityQuery,
          },
        };
        const response = await fetch(`${SHOPIFY_APP_URL}/nova-poshta/general`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const { data } = await response.json();
        setCities(data || []);
      } catch (error) {
        console.error('Failed to fetch cities', error);
      } finally {
        setLoadingCities(false);
      }
    };

    fetchCities();
  }, [cityQuery]);

  // Fetch warehouses for the selected city
  useEffect(() => {
    if (!selectedCity) {
      setWarehouses([]);
      return;
    }

    const fetchWarehouses = async () => {
      setLoadingWarehouses(true);
      try {
        const response = await fetch(`${SHOPIFY_APP_URL}/nova-poshta/general`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelName: 'AddressGeneral',
            calledMethod: 'getWarehouses',
            methodProperties: {
              CityRef: selectedCity,
            },
          }),
        });
        const { data } = await response.json();
        setWarehouses(data || []);
      } catch (error) {
        console.error('Failed to fetch warehouses', error);
      } finally {
        setLoadingWarehouses(false);
      }
    };

    fetchWarehouses();
  }, [selectedCity]);

  return (
    <BlockStack>
      <TextField
        label='Редагуйте назву пункта'
        value={cityQuery}
        onChange={setCityQuery}
        placeholder='Назва'
      />
      <InlineStack gap>
        {!loadingCities && cities.length > 0 && (
          <Select
            label='Оберіть пункт'
            options={cities.map((city) => ({
              value: city.Ref,
              label: city.Description,
            }))}
            onChange={(value) => {
              setSelectedCity(value);
              setSelectedWarehouse(null);
            }}
            value={selectedCity || ''}
          />
        )}
        {selectedCity && !loadingWarehouses && warehouses.length > 0 && (
          <Select
            label='Оберіть відділення'
            options={warehouses.map((warehouse) => ({
              value: warehouse.Ref,
              label: warehouse.Description,
            }))}
            onChange={setSelectedWarehouse}
            value={selectedWarehouse || ''}
          />
        )}
      </InlineStack>
    </BlockStack>
  );
}
