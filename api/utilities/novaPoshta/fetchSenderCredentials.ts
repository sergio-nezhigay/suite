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
  console.log('🔍 Fetching Nova Poshta sender credentials...\n');

  try {
    // ============================================
    // 1. Fetch Counterparty (Sender) Information
    // ============================================
    console.log('📋 Step 1: Fetching your counterparty information...');

    const counterpartyResponse = await npClient({
      modelName: 'Counterparty',
      calledMethod: 'getCounterparties',
      methodProperties: {
        CounterpartyProperty: 'Sender',
      },
    });

    if (!counterpartyResponse.success || !counterpartyResponse.data?.length) {
      console.log('❌ Failed to fetch counterparty data');
      return {
        success: false,
        error: 'No counterparty found. Make sure you have a sender account in Nova Poshta.',
      };
    }

    const counterparty = counterpartyResponse.data[0] as CounterpartyData;
    console.log('\n✅ Counterparty found:');
    console.log('   SENDER_REF:', counterparty.Ref);
    console.log('   Name:', counterparty.Description);
    console.log('   City:', counterparty.City);

    // ============================================
    // 2. Fetch Contact Person
    // ============================================
    console.log('\n📋 Step 2: Fetching contact persons...');

    const contactResponse = await npClient({
      modelName: 'Counterparty',
      calledMethod: 'getCounterpartyContactPersons',
      methodProperties: {
        Ref: counterparty.Ref,
      },
    });

    if (!contactResponse.success || !contactResponse.data?.length) {
      console.log('❌ No contact persons found');
      console.log('⚠️  You need to create a contact person in Nova Poshta cabinet!');
    } else {
      const contact = contactResponse.data[0];
      console.log('\n✅ Contact person found:');
      console.log('   SENDER_CONTACT_REF:', contact.Ref);
      console.log('   Name:', contact.Description);
      console.log('   Phone:', contact.Phones);
      console.log('   Email:', contact.Email || 'N/A');
    }

    // ============================================
    // 3. Search for Буча City
    // ============================================
    console.log('\n📋 Step 3: Searching for Буча city...');

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

      console.log('\n✅ Буча city found:');
      console.log('   SENDER_CITY_REF:', buchaCity.Ref);
      console.log('   Description:', buchaCity.Description);
      console.log('   Area:', buchaCity.AreaDescription);
    } else {
      console.log('❌ Failed to find Буча city');
    }

    // ============================================
    // 4. Fetch Warehouses in Буча (looking for №6)
    // ============================================
    if (buchaCity) {
      console.log('\n📋 Step 4: Searching for warehouses in Буча...');

      const warehouseResponse = await npClient({
        modelName: 'AddressGeneral',
        calledMethod: 'getWarehouses',
        methodProperties: {
          CityRef: buchaCity.Ref,
        },
      });

      if (warehouseResponse.success && warehouseResponse.data?.length) {
        console.log(`\n✅ Found ${warehouseResponse.data.length} warehouses in Буча`);

        // Find warehouse №6
        const warehouse6 = warehouseResponse.data.find((w: WarehouseData) =>
          w.Number === '6'
        ) as WarehouseData;

        if (warehouse6) {
          console.log('\n🎯 Warehouse №6 found:');
          console.log('   SENDER_WAREHOUSE_REF:', warehouse6.Ref);
          console.log('   Description:', warehouse6.Description);
          console.log('   Number:', warehouse6.Number);
          console.log('   Address:', warehouse6.ShortAddress);
        } else {
          console.log('\n⚠️  Warehouse №6 not found. Available warehouses:');
          warehouseResponse.data.slice(0, 5).forEach((w: WarehouseData) => {
            console.log(`   - №${w.Number}: ${w.ShortAddress}`);
          });
          if (warehouseResponse.data.length > 5) {
            console.log(`   ... and ${warehouseResponse.data.length - 5} more`);
          }
        }
      } else {
        console.log('❌ Failed to fetch warehouses');
      }
    }

    // ============================================
    // 5. Fetch Sender Addresses (alternative method)
    // ============================================
    console.log('\n📋 Step 5: Fetching your registered addresses...');

    const addressResponse = await npClient({
      modelName: 'Counterparty',
      calledMethod: 'getCounterpartyAddresses',
      methodProperties: {
        Ref: counterparty.Ref,
        CounterpartyProperty: 'Sender',
      },
    });

    if (addressResponse.success && addressResponse.data?.length) {
      console.log(`\n✅ Found ${addressResponse.data.length} registered address(es):`);
      addressResponse.data.forEach((addr: AddressData, index: number) => {
        console.log(`\n   Address ${index + 1}:`);
        console.log('   Ref:', addr.Ref);
        console.log('   Description:', addr.Description);
        console.log('   City:', addr.CityDescription);
        console.log('   CityRef:', addr.CityRef);
      });
    } else {
      console.log('⚠️  No registered addresses found for this counterparty');
    }

    // ============================================
    // Summary
    // ============================================
    console.log('\n' + '='.repeat(60));
    console.log('📝 SUMMARY - Copy these values to senderConfig.ts:');
    console.log('='.repeat(60));
    console.log(`\nSENDER_REF: '${counterparty.Ref}'`);

    if (buchaCity) {
      console.log(`SENDER_CITY_REF: '${buchaCity.Ref}'  // ${buchaCity.Description}`);
    }

    if (contactResponse.success && contactResponse.data?.length) {
      const contact = contactResponse.data[0];
      console.log(`SENDER_CONTACT_REF: '${contact.Ref}'  // ${contact.Description}`);
      console.log(`SENDER_PHONE: '${contact.Phones}'`);
    }

    console.log('\n⚠️  IMPORTANT: For SENDER_WAREHOUSE_REF, you need to:');
    console.log('   1. Check the warehouse list above');
    console.log('   2. Or use the registered addresses from Step 5');
    console.log('   3. Make sure the warehouse belongs to YOUR counterparty');
    console.log('\n');

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
    console.log('❌ Error fetching credentials:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}
