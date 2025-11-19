import { npClient } from "utilities";
import type { ActionOptions } from "gadget-server";

export const options: ActionOptions = {};


/**
 * Global Action: Fetch Nova Poshta Sender Credentials
 *
 * This action will fetch your actual Nova Poshta credentials and log them.
 * Run this from Gadget dashboard: Actions > fetchNovaPoshtaCredentials > Run
 *
 * It will find:
 * - Your counterparty (sender) reference
 * - Your contact person reference
 * - Буча city reference
 * - Warehouse №6 in Буча
 * - Your registered addresses
 */

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

export const run = async ({ logger }) => {
  logger.info('🔍 Fetching Nova Poshta sender credentials...');

  try {
    // ============================================
    // 1. Fetch Counterparty (Sender) Information
    // ============================================
    logger.info('📋 Step 1: Fetching your counterparty information...');

    const counterpartyResponse = await npClient({
      modelName: 'Counterparty',
      calledMethod: 'getCounterparties',
      methodProperties: {
        CounterpartyProperty: 'Sender',
      },
    });

    if (!counterpartyResponse.success || !counterpartyResponse.data?.length) {
      logger.error('❌ Failed to fetch counterparty data');
      throw new Error('No counterparty found. Make sure you have a sender account in Nova Poshta.');
    }

    const counterparty = counterpartyResponse.data[0] as CounterpartyData;
    logger.info('✅ Counterparty found:', {
      SENDER_REF: counterparty.Ref,
      Name: counterparty.Description,
      City: counterparty.City,
    });

    // ============================================
    // 2. Fetch Contact Person
    // ============================================
    logger.info('📋 Step 2: Fetching contact persons...');

    const contactResponse = await npClient({
      modelName: 'Counterparty',
      calledMethod: 'getCounterpartyContactPersons',
      methodProperties: {
        Ref: counterparty.Ref,
      },
    });

    let contactInfo = null;
    if (!contactResponse.success || !contactResponse.data?.length) {
      logger.warn('❌ No contact persons found');
      logger.warn('⚠️  You need to create a contact person in Nova Poshta cabinet!');
    } else {
      const contact = contactResponse.data[0];
      contactInfo = {
        SENDER_CONTACT_REF: contact.Ref,
        Name: contact.Description,
        Phone: contact.Phones,
        Email: contact.Email || 'N/A',
      };
      logger.info('✅ Contact person found:', contactInfo);
    }

    // ============================================
    // 3. Search for Буча City
    // ============================================
    logger.info('📋 Step 3: Searching for Буча city...');

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

      logger.info('✅ Буча city found:', {
        SENDER_CITY_REF: buchaCity.Ref,
        Description: buchaCity.Description,
        Area: buchaCity.AreaDescription,
      });
    } else {
      logger.warn('❌ Failed to find Буча city');
    }

    // ============================================
    // 4. Fetch Warehouses in Буча (looking for №6)
    // ============================================
    let warehouse6Info = null;
    if (buchaCity) {
      logger.info('📋 Step 4: Searching for warehouses in Буча...');

      const warehouseResponse = await npClient({
        modelName: 'AddressGeneral',
        calledMethod: 'getWarehouses',
        methodProperties: {
          CityRef: buchaCity.Ref,
        },
      });

      if (warehouseResponse.success && warehouseResponse.data?.length) {
        logger.info(`✅ Found ${warehouseResponse.data.length} warehouses in Буча`);

        // Find warehouse №6
        const warehouse6 = warehouseResponse.data.find((w: WarehouseData) =>
          w.Number === '6'
        ) as WarehouseData;

        if (warehouse6) {
          warehouse6Info = {
            SENDER_WAREHOUSE_REF: warehouse6.Ref,
            Description: warehouse6.Description,
            Number: warehouse6.Number,
            Address: warehouse6.ShortAddress,
          };
          logger.info('🎯 Warehouse №6 found:', warehouse6Info);
        } else {
          logger.warn('⚠️  Warehouse №6 not found. Available warehouses:');
          const availableWarehouses = warehouseResponse.data.slice(0, 10).map((w: WarehouseData) => ({
            Number: w.Number,
            Ref: w.Ref,
            Address: w.ShortAddress,
          }));
          logger.info({ availableWarehouses });
        }
      } else {
        logger.warn('❌ Failed to fetch warehouses');
      }
    }

    // ============================================
    // 5. Fetch Sender Addresses (alternative method)
    // ============================================
    logger.info('📋 Step 5: Fetching your registered addresses...');

    const addressResponse = await npClient({
      modelName: 'Counterparty',
      calledMethod: 'getCounterpartyAddresses',
      methodProperties: {
        Ref: counterparty.Ref,
        CounterpartyProperty: 'Sender',
      },
    });

    let registeredAddresses = [];
    if (addressResponse.success && addressResponse.data?.length) {
      registeredAddresses = addressResponse.data.map((addr: AddressData) => ({
        Ref: addr.Ref,
        Description: addr.Description,
        City: addr.CityDescription,
        CityRef: addr.CityRef,
      }));
      logger.info(`✅ Found ${addressResponse.data.length} registered address(es):`, {
        registeredAddresses,
      });
    } else {
      logger.warn('⚠️  No registered addresses found for this counterparty');
    }

    // ============================================
    // Summary
    // ============================================
    logger.info('='.repeat(60));
    logger.info('📝 SUMMARY - Copy these values to senderConfig.ts:');
    logger.info('='.repeat(60));

    const summary = {
      SENDER_REF: counterparty.Ref,
      SENDER_CITY_REF: buchaCity?.Ref || 'NOT_FOUND',
      SENDER_WAREHOUSE_REF: warehouse6Info?.SENDER_WAREHOUSE_REF || 'NOT_FOUND_CHECK_REGISTERED_ADDRESSES',
      SENDER_CONTACT_REF: contactInfo?.SENDER_CONTACT_REF || 'NOT_FOUND_CREATE_CONTACT_PERSON',
      SENDER_PHONE: contactInfo?.Phone || 'NOT_FOUND',
    };

    logger.info('Configuration to use:', summary);

    logger.info('\n⚠️  IMPORTANT NOTES:');
    logger.info('1. If SENDER_WAREHOUSE_REF is NOT_FOUND, check the registered addresses above');
    logger.info('2. If SENDER_CONTACT_REF is NOT_FOUND, create a contact person in Nova Poshta cabinet first');
    logger.info('3. Make sure the warehouse belongs to YOUR counterparty');

    return {
      success: true,
      summary,
      details: {
        counterparty: {
          Ref: counterparty.Ref,
          Name: counterparty.Description,
          City: counterparty.City,
        },
        contact: contactInfo,
        city: buchaCity ? {
          Ref: buchaCity.Ref,
          Description: buchaCity.Description,
        } : null,
        warehouse6: warehouse6Info,
        registeredAddresses,
      },
    };
  } catch (error: any) {
    logger.error('❌ Error fetching credentials:', { error: error.message });
    throw error;
  }
};

