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
  Button,
} from '@shopify/ui-extensions-react/admin';

interface City {
  Ref: string;
  Description: string;
  AreaDescription: string;
}

import { SHOPIFY_APP_URL } from '../../shared/data';
import {
  NovaPoshtaWarehouse,
  updateWarehouse,
} from '../../shared/shopifyOperations';

interface WarehouseNP {
  Ref: string;
  Description: string;
}

function containsOnlyOneWord(str: string) {
  return str.trim().split(/\s+/).length === 1;
}

export default function NovaPoshtaSelector({
  bestWarehouse,
  updateProbability,
  orderId,
}: {
  bestWarehouse: NovaPoshtaWarehouse;
  updateProbability: () => void;
  orderId: string;
}) {
  const [cityQuery, setCityQuery] = useState(
    bestWarehouse?.cityDescription
      ? bestWarehouse?.cityDescription.toLowerCase()
      : ''
  );
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCity, setSelectedCity] = useState<string | null>(
    bestWarehouse?.cityRef
  );

  const [warehouses, setWarehouses] = useState<WarehouseNP[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string | null>(
    bestWarehouse?.warehouseRef
  );

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!cityQuery || cityQuery.trim() === '') {
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
        if (data && data.length === 1) {
          setSelectedCity(data[0].Ref);
        }
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
        if (data && data.length === 1) {
          setSelectedWarehouse(data[0].Ref);
        }
        setWarehouses(data || []);
      } catch (error) {
        console.error('Failed to fetch warehouses', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWarehouses();
  }, [selectedCity]);

  const logSelectedValues = async () => {
    const selectedCityObj = cities.find((city) => city.Ref === selectedCity);

    const selectedWarehouseObj = warehouses.find(
      (warehouse) => warehouse.Ref === selectedWarehouse
    );

    await updateWarehouse({
      warehouse: {
        cityRef: selectedCity,
        cityDescription: selectedCityObj?.Description,
        warehouseRef: selectedWarehouse,
        warehouseDescription: selectedWarehouseObj?.Description,
        matchProbability: 1,
      },
      orderId,
    });
    updateProbability();
  };

  return (
    <BlockStack gap>
      {loading && <ProgressIndicator size='small-300' />}
      <TextField
        label='Редагуйте назву пункта'
        value={cityQuery}
        onChange={setCityQuery}
        placeholder='Назва'
      />
      <InlineStack gap>
        {cities.length > 0 && (
          <InlineStack inlineSize={`${40}%`}>
            <Select
              label='Оберіть пункт'
              options={cities.map((city) => {
                const label = containsOnlyOneWord(city.Description)
                  ? `${city.Description} (${city.AreaDescription} обл.)`
                  : city.Description;
                return {
                  value: city.Ref,
                  label: label,
                };
              })}
              onChange={(value) => {
                setSelectedCity(value);
                setSelectedWarehouse(null);
              }}
              value={selectedCity || ''}
            />
          </InlineStack>
        )}
        {selectedCity && warehouses.length > 0 && (
          <InlineStack inlineSize={`${60}%`}>
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

      <Button
        onClick={logSelectedValues}
        disabled={selectedCity && selectedWarehouse ? false : true}
      >
        {selectedCity && selectedWarehouse
          ? 'Зберегти адресу'
          : 'Адреса не обрана'}
      </Button>
    </BlockStack>
  );
}
