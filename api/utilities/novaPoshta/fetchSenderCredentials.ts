/**
 * Helper script to fetch Nova Poshta sender credentials
 *
 * This script will help you find:
 * 1. Your counterparty (sender) reference
 * 2. Your contact person reference
 * 3. Your city reference (Буча)
 * 4. Your warehouse reference (Warehouse №6 in Bucha)
 *
 * Usage:
 * 1. Make sure your NOVA_POSHTA_API_KEY is set in Gadget environment
 * 2. Run this as a global action or test it via API route
 */

import { npClient } from '../http/npClient';

interface CounterpartyData {
  Ref: string;
  Description: string;
  City: string;
  Counterparty: string;
  OwnershipForm: string;
  FirstName?: string;
  LastName?: string;
  MiddleName?: string;
  ContactPerson?: {
    data: Array<{
      Ref: string;
      Description: string;
      Phones: string;
      Email: string;
    }>;
  };
}

interface AddressData {
  Ref: string;
  Description: string;
  CityRef: string;
  CityDescription: string;
  SettlementRef: string;
  SettlementDescription: string;
}

interface CityData {
  Ref: string;
  Description: string;
  DescriptionRu: string;
  AreaDescription: string;
}

interface WarehouseData {
  Ref: string;
  Description: string;
  Number: string;
  CityRef: string;
  CityDescription: string;
  ShortAddress: string;
}

export async function fetchSenderCredentials() {
  try {
    // ============================================
    // 1. Fetch Counterparty (Sender) Information
    // ============================================
    const counterpartyResponse = await npClient({
      modelName: 'Counterparty',
      calledMethod: 'getCounterparties',
      methodProperties: {
        CounterpartyProperty: 'Sender',
      },
    });

    if (!counterpartyResponse.success || !counterpartyResponse.data?.length) {
      return {
        success: false,
        error: 'No counterparty found. Make sure you have a sender account in Nova Poshta.',
      };
    }

    const counterparty = counterpartyResponse.data[0] as CounterpartyData;
    // ============================================
    // 2. Fetch Contact Person
    // ============================================
    const contactResponse = await npClient({
      modelName: 'Counterparty',
      calledMethod: 'getCounterpartyContactPersons',
      methodProperties: {
        Ref: counterparty.Ref,
      },
    });

    if (!contactResponse.success || !contactResponse.data?.length) {
    } else {
      const contact = contactResponse.data[0];
    }

    // ============================================
    // 3. Search for Буча City
    // ============================================
    const cityResponse = await npClient({
      modelName: 'Address',
      calledMethod: 'getCities',
      methodProperties: {
        FindByString: 'Буча',
      },
    });

    let buchaCity: CityData | null = null;
    if (cityResponse.success && cityResponse.data?.length) {
      // Find exact match for Буча
      buchaCity = cityResponse.data.find((city: CityData) =>
        city.Description === 'Буча' || city.Description.startsWith('Буча,')
      ) as CityData || cityResponse.data[0] as CityData;
    } else {
    }

    // ============================================
    // 4. Fetch Warehouses in Буча (looking for №6)
    // ============================================
    if (buchaCity) {
      const warehouseResponse = await npClient({
        modelName: 'AddressGeneral',
        calledMethod: 'getWarehouses',
        methodProperties: {
          CityRef: buchaCity.Ref,
        },
      });

      if (warehouseResponse.success && warehouseResponse.data?.length) {
        // Find warehouse №6
        const warehouse6 = warehouseResponse.data.find((w: WarehouseData) =>
          w.Number === '6'
        ) as WarehouseData;

        if (warehouse6) {
        } else {
          warehouseResponse.data.slice(0, 5).forEach((w: WarehouseData) => {
          });
          if (warehouseResponse.data.length > 5) {
          }
        }
      } else {
      }
    }

    // ============================================
    // 5. Fetch Sender Addresses (alternative method)
    // ============================================
    const addressResponse = await npClient({
      modelName: 'Counterparty',
      calledMethod: 'getCounterpartyAddresses',
      methodProperties: {
        Ref: counterparty.Ref,
        CounterpartyProperty: 'Sender',
      },
    });

    if (addressResponse.success && addressResponse.data?.length) {
      addressResponse.data.forEach((addr: AddressData, index: number) => {
      });
    } else {
    }

    // ============================================
    // Summary
    // ============================================
    if (buchaCity) {
    }

    if (contactResponse.success && contactResponse.data?.length) {
      const contact = contactResponse.data[0];
    }
    return {
      success: true,
      data: {
        counterparty,
        city: buchaCity,
        contact: contactResponse.data?.[0],
        addresses: addressResponse.data,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}
