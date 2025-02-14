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
  OrderInfo,
  updateWarehouse,
} from '../../shared/shopifyOperations';
import { SHOPIFY_APP_URL } from '../../shared/data';

type City = { Ref: string; Description: string; AreaDescription: string };
type Warehouse = { Ref: string; Description: string };

const isSingleWord = (str: string) => str.trim().split(/\s+/).length === 1;

const useCitySuggestions = ({
  searchQuery,
  setChosenCityRef,
  editModeActive,
}: {
  searchQuery: string;
  setChosenCityRef: (ref: string | null) => void;
  editModeActive: boolean;
}) => {
  const [cityOptions, setCityOptions] = useState<City[]>([]);
  const [isLoading, setLoading] = useState(false);

  useEffect(() => {
    if (!editModeActive || !searchQuery.trim()) {
      setCityOptions([]);
      return;
    }

    const fetchCities = async () => {
      setLoading(true);
      try {
        const { data } = await makeRequestNovaPoshta({
          modelName: 'Address',
          calledMethod: 'getCities',
          methodProperties: { FindByString: searchQuery },
        });
        setCityOptions(data || []);
        setChosenCityRef(data?.length ? data[0].Ref : null);
      } catch (error) {
        console.error('Failed to fetch cities', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCities();
  }, [searchQuery, editModeActive]);

  return { cityOptions, isLoading };
};

const useWarehouseSuggestions = ({
  chosenCityRef,
  setChosenWarehouseRef,
  editModeActive,
  novaPoshtaWarehouseRef,
}: {
  chosenCityRef: string | null;
  setChosenWarehouseRef: (ref: string | null) => void;
  editModeActive: boolean;
  novaPoshtaWarehouseRef?: string | null;
}) => {
  const [warehouseOptions, setWarehouseOptions] = useState<Warehouse[]>([]);
  const [isLoading, setLoading] = useState(false);

  useEffect(() => {
    if (!editModeActive || !chosenCityRef) {
      setWarehouseOptions([]);
      return;
    }

    const fetchWarehouses = async () => {
      console.log('fetchWarehouses');
      setLoading(true);
      try {
        const response = await makeRequestNovaPoshta({
          modelName: 'AddressGeneral',
          calledMethod: 'getWarehouses',
          methodProperties: { CityRef: chosenCityRef },
        });
        const data = (response.data || []) as Warehouse[];
        setWarehouseOptions(data);

        let newRef: string | null = null;
        if (data?.length === 1) {
          newRef = data[0].Ref;
        } else if (novaPoshtaWarehouseRef) {
          const matchedWarehouse = data?.find(
            (w: Warehouse) => w.Ref === novaPoshtaWarehouseRef
          );
          if (matchedWarehouse) {
            newRef = novaPoshtaWarehouseRef;
          }
        }
        setChosenWarehouseRef(newRef);
      } catch (error) {
        console.error('Failed to fetch warehouses', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWarehouses();
  }, [chosenCityRef, novaPoshtaWarehouseRef, editModeActive]);

  return { warehouseOptions, isLoading };
};

export default function NovaPoshtaSelector({
  novaPoshtaWarehouse,
  setNovaPoshtaWarehouse,
  orderInfo,
}: {
  novaPoshtaWarehouse?: NovaPoshtaWarehouse;
  setNovaPoshtaWarehouse: (warehouse: NovaPoshtaWarehouse) => void;
  orderInfo: OrderInfo;
}) {
  const [editModeActive, setEditModeActive] = useState(false);

  const [searchQuery, setSearchQuery] = useState(
    novaPoshtaWarehouse?.cityDescription?.toLowerCase() || ''
  );
  const [chosenCityRef, setChosenCityRef] = useState<string | null>(
    novaPoshtaWarehouse?.cityRef || null
  );
  const [chosenWarehouseRef, setChosenWarehouseRef] = useState<string | null>(
    novaPoshtaWarehouse?.warehouseRef || null
  );

  const { cityOptions, isLoading: isLoadingCities } = useCitySuggestions({
    searchQuery,
    setChosenCityRef,
    editModeActive,
  });
  const { warehouseOptions, isLoading: isLoadingWarehouses } =
    useWarehouseSuggestions({
      chosenCityRef,
      setChosenWarehouseRef,
      editModeActive,
      novaPoshtaWarehouseRef: novaPoshtaWarehouse?.warehouseRef,
    });

  const saveWarehouse = async () => {
    const selectedCity = cityOptions.find((city) => city.Ref === chosenCityRef);
    const selectedWarehouse = warehouseOptions.find(
      (warehouse) => warehouse.Ref === chosenWarehouseRef
    );

    if (orderInfo?.orderDetails?.id) {
      console.log('orderInfo.orderDetails=', orderInfo?.orderDetails);
      await updateWarehouse({
        warehouse: {
          cityRef: chosenCityRef || '',
          cityDescription: selectedCity?.Description || '',
          warehouseRef: chosenWarehouseRef || '',
          warehouseDescription: selectedWarehouse?.Description || '',
          matchProbability: 1,
        },
        orderId: orderInfo.orderDetails.id,
      });
    }

    setNovaPoshtaWarehouse({
      cityDescription: selectedCity?.Description,
      warehouseDescription: selectedWarehouse?.Description,
      cityRef: chosenCityRef || '',
      warehouseRef: chosenWarehouseRef || '',
      matchProbability: 1,
    });
  };

  return (
    <BlockStack rowGap='base'>
      {novaPoshtaWarehouse?.cityDescription &&
        novaPoshtaWarehouse?.warehouseDescription && (
          <InlineStack gap inlineAlignment='space-between'>
            <Text fontWeight='bold'>Збережено:</Text>
            <Text>
              {formatSettlement(novaPoshtaWarehouse)};{' '}
              {novaPoshtaWarehouse.warehouseDescription}
            </Text>
          </InlineStack>
        )}

      {editModeActive ? (
        <>
          <TextField
            label='Редагуйте назву пункта:'
            value={searchQuery}
            onChange={(value) => {
              setSearchQuery(value);
              setChosenWarehouseRef(null);
            }}
            placeholder='Назва'
          />
          <InlineStack gap>
            <InlineStack inlineSize='40%'>
              {isLoadingCities ? (
                <ProgressIndicator size='small-300' />
              ) : (
                <Select
                  label='Оберіть пункт..'
                  options={cityOptions.map((city) => ({
                    value: city.Ref,
                    label: isSingleWord(city.Description)
                      ? `${city.Description} (${city.AreaDescription} обл.)`
                      : city.Description,
                  }))}
                  onChange={setChosenCityRef}
                  value={chosenCityRef || ''}
                />
              )}
            </InlineStack>
            {isLoadingWarehouses ? (
              <ProgressIndicator size='small-300' />
            ) : (
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
            onClick={saveWarehouse}
            disabled={!chosenCityRef || !chosenWarehouseRef}
          >
            {chosenCityRef && chosenWarehouseRef
              ? 'Зберегти адресу'
              : 'Адреса не обрана'}
          </Button>
        </>
      ) : (
        <Button onClick={() => setEditModeActive(true)}>
          Редагувати адресу
        </Button>
      )}
    </BlockStack>
  );
}

const hasCommonRoot = (cityName: string, areaName: string) => {
  const normalizedCity = cityName.toLowerCase().replace(/и|і|ї|є/g, 'i');
  const normalizedArea = areaName.toLowerCase().replace(/и|і|ї|є/g, 'i');

  return normalizedArea.startsWith(normalizedCity.slice(0, 3));
};

const formatSettlement = (city: NovaPoshtaWarehouse) => {
  if (!city || !city.cityDescription) return '';
  if (!city.settlementAreaDescription) return city.cityDescription;
  if (hasCommonRoot(city.cityDescription, city.settlementAreaDescription)) {
    return city.cityDescription;
  }
  return `${city.cityDescription}, ${city.settlementAreaDescription} обл.`;
};

export async function makeRequestNovaPoshta(payload: object) {
  try {
    const res = await fetch(`${SHOPIFY_APP_URL}/nova-poshta/general`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data.error ||
          'An error occurred while processing the Nova Poshta request.'
      );
    }

    return data;
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Unknown error');
  }
}
