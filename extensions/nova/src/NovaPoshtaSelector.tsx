import { useEffect, useState } from 'react';
import {
  render,
  BlockStack,
  InlineStack,
  Section,
  TextField,
  Select,
  Text,
  ProgressIndicator,
} from '@shopify/ui-extensions-react/admin';

interface City {
  Ref: string;
  Description: string;
}

import { SHOPIFY_APP_URL } from '../../shared/data';
import { NovaPoshtaWarehouse } from '../../shared/shopifyOperations';

interface WarehouseNP {
  Ref: string;
  Description: string;
}

export default function NovaPoshtaSelector({
  bestWarehouse,
}: {
  bestWarehouse: NovaPoshtaWarehouse;
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

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (cityQuery.trim() === '') {
      setCities([]);
      return;
    }

    const fetchCities = async () => {
      setLoading(true);
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
        setLoading(false);
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
      setLoading(true);
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
        setLoading(false);
      }
    };

    fetchWarehouses();
  }, [selectedCity]);

  return (
    <BlockStack>
      {loading ? (
        <ProgressIndicator size='small-300' />
      ) : (
        <>
          <TextField
            label='Редагуйте назву пункта'
            value={cityQuery}
            onChange={setCityQuery}
            placeholder='Назва'
          />
          <InlineStack gap>
            {cities.length > 0 && (
              <InlineStack inlineSize={`${35}%`}>
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
              </InlineStack>
            )}
            {selectedCity && warehouses.length > 0 && (
              <InlineStack inlineSize={`${65}%`}>
                <Select
                  label='Оберіть відділення'
                  options={warehouses.map((warehouse) => ({
                    value: warehouse.Ref,
                    label: warehouse.Description,
                  }))}
                  onChange={setSelectedWarehouse}
                  value={selectedWarehouse || ''}
                />
              </InlineStack>
            )}
          </InlineStack>
        </>
      )}
    </BlockStack>
  );
}
