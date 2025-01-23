import { useEffect, useState } from 'react';
import {
  BlockStack,
  InlineStack,
  TextField,
  Select,
  ProgressIndicator,
  Button,
  Text,
} from '@shopify/ui-extensions-react/admin';
import {
  NovaPoshtaWarehouse,
  updateWarehouse,
} from '../../shared/shopifyOperations';
import useNovaposhtaApiKey from './useNovaposhtaApiKey';

interface City {
  Ref: string;
  Description: string;
  AreaDescription: string;
}

interface WarehouseNP {
  Ref: string;
  Description: string;
}

const novaposhtaApiUrl = 'https://api.novaposhta.ua/v2.0/json/';

function isSingleWord(str: string) {
  return str.trim().split(/\s+/).length === 1;
}

async function fetchData(url: string, payload: any) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return response.json();
}

function useCitySuggestions(searchQuery: string, apiKey: string | null) {
  const [cityOptions, setCityOptions] = useState<City[]>([]);
  const [isLoading, setLoading] = useState(false);

  useEffect(() => {
    if (!apiKey || !searchQuery || searchQuery.trim() === '') {
      setCityOptions([]);
      return;
    }

    const fetchCitySuggestions = async () => {
      setLoading(true);
      try {
        const payload = {
          modelName: 'Address',
          calledMethod: 'getCities',
          methodProperties: { FindByString: searchQuery },
          apiKey,
        };
        const { data } = await fetchData(novaposhtaApiUrl, payload);
        setCityOptions(data || []);
      } catch (error) {
        console.error('Failed to fetch cities', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCitySuggestions();
  }, [searchQuery, apiKey]);

  return { cityOptions, isLoading };
}

function useWarehouseSuggestions(
  chosenCityRef: string | null,
  apiKey: string | null
) {
  const [warehouseOptions, setWarehouseOptions] = useState<WarehouseNP[]>([]);
  const [isLoading, setLoading] = useState(false);

  useEffect(() => {
    if (!chosenCityRef || !apiKey) {
      setWarehouseOptions([]);
      return;
    }

    const fetchWarehouseSuggestions = async () => {
      setLoading(true);
      try {
        const payload = {
          modelName: 'AddressGeneral',
          calledMethod: 'getWarehouses',
          methodProperties: { CityRef: chosenCityRef },
          apiKey,
        };
        const { data } = await fetchData(novaposhtaApiUrl, payload);
        setWarehouseOptions(data || []);
      } catch (error) {
        console.error('Failed to fetch warehouses', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWarehouseSuggestions();
  }, [chosenCityRef, apiKey]);

  return { warehouseOptions, isLoading };
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
  const [searchQuery, setSearchQuery] = useState(
    bestWarehouse?.cityDescription?.toLowerCase() || ''
  );
  const [chosenCityRef, setChosenCityRef] = useState<string | null>(
    bestWarehouse?.cityRef || null
  );
  const [chosenWarehouseRef, setChosenWarehouseRef] = useState<string | null>(
    bestWarehouse?.warehouseRef || null
  );

  const { apiKey, error, loadingApiKey } = useNovaposhtaApiKey();
  const { cityOptions, isLoading: isLoadingCities } = useCitySuggestions(
    searchQuery,
    apiKey
  );
  const { warehouseOptions, isLoading: isLoadingWarehouses } =
    useWarehouseSuggestions(chosenCityRef, apiKey);

  const saveSelectedCityAndWarehouse = async () => {
    const selectedCityObj = cityOptions.find(
      (city) => city.Ref === chosenCityRef
    );
    const selectedWarehouseObj = warehouseOptions.find(
      (warehouse) => warehouse.Ref === chosenWarehouseRef
    );

    await updateWarehouse({
      warehouse: {
        cityRef: chosenCityRef || '',
        cityDescription: selectedCityObj?.Description || '',
        warehouseRef: chosenWarehouseRef || '',
        warehouseDescription: selectedWarehouseObj?.Description || '',
        matchProbability: 1,
      },
      orderId,
    });
    updateProbability();
  };

  if (loadingApiKey || isLoadingCities || isLoadingWarehouses) {
    return <ProgressIndicator size='small-300' />;
  }

  if (error) {
    return <Text>Error: {error}</Text>;
  }

  if (!apiKey) {
    return <Text>No API key found.</Text>;
  }

  return (
    <BlockStack gap>
      <TextField
        label='Редагуйте назву пункта:'
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder='Назва'
      />
      <InlineStack gap>
        {cityOptions.length > 0 && (
          <InlineStack inlineSize='40%'>
            <Select
              label='Оберіть пункт..'
              options={cityOptions.map((city) => ({
                value: city.Ref,
                label: isSingleWord(city.Description)
                  ? `${city.Description} (${city.AreaDescription} обл.)`
                  : city.Description,
              }))}
              onChange={(value) => {
                setChosenCityRef(value);
                setChosenWarehouseRef(null);
              }}
              value={chosenCityRef || ''}
            />
          </InlineStack>
        )}
        {chosenCityRef && warehouseOptions.length > 0 && (
          <InlineStack inlineSize='60%'>
            <Select
              label='Оберіть відділення'
              options={warehouseOptions.map((warehouse) => ({
                value: warehouse.Ref,
                label: warehouse.Description,
              }))}
              onChange={setChosenWarehouseRef}
              value={chosenWarehouseRef || ''}
            />
          </InlineStack>
        )}
      </InlineStack>

      <Button
        onClick={saveSelectedCityAndWarehouse}
        disabled={!chosenCityRef || !chosenWarehouseRef}
      >
        {chosenCityRef && chosenWarehouseRef
          ? 'Зберегти адресу'
          : 'Адреса не обрана'}
      </Button>
    </BlockStack>
  );
}
