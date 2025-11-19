/**
 * Helper script to fetch Nova Poshta sender credentials
 *
 * This script calls Nova Poshta API to retrieve:
 * - Your sender counterparty reference (SENDER_REF)
 * - Your contact person reference (SENDER_CONTACT_REF)
 * - Your warehouses (SENDER_WAREHOUSE_REF)
 *
 * Run with: node scripts/fetch-nova-poshta-credentials.js
 */

// Try to read API key from environment or .env file
let API_KEY = process.env.NP_API_KEY_SSh;

// If not in environment, try reading from .env file
if (!API_KEY) {
  try {
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(__dirname, '..', '.env');

    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const match = envContent.match(/NP_API_KEY_SSh\s*=\s*["']?([^"'\n\r]+)["']?/);
      if (match) {
        API_KEY = match[1].trim();
      }
    }
  } catch (err) {
    // Ignore errors reading .env
  }
}

if (!API_KEY) {
  console.error('❌ Error: NP_API_KEY_SSh not found');
  console.error('Please set your Nova Poshta API key in .env file or environment');
  console.error('\nYou can pass it as an argument:');
  console.error('  node scripts/fetch-nova-poshta-credentials.js YOUR_API_KEY');

  // Check if API key passed as argument
  if (process.argv[2]) {
    API_KEY = process.argv[2];
    console.log('\n✅ Using API key from command line argument');
  } else {
    process.exit(1);
  }
}

async function fetchNovaPoshtaData(payload) {
  try {
    const response = await fetch('https://api.novaposhta.ua/v2.0/json/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        apiKey: API_KEY,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      console.error('Nova Poshta API Error:', data);
      throw new Error(data.errors?.[0] || 'Unknown API error');
    }

    return data;
  } catch (error) {
    console.error('Request failed:', error.message);
    throw error;
  }
}

async function fetchSenderCredentials() {
  console.log('🔍 Fetching your Nova Poshta sender credentials...\n');

  // ============================================
  // 1. Fetch Sender Counterparty
  // ============================================
  console.log('📋 Step 1: Fetching sender counterparty...');

  try {
    const counterpartyResponse = await fetchNovaPoshtaData({
      modelName: 'Counterparty',
      calledMethod: 'getCounterparties',
      methodProperties: {
        CounterpartyProperty: 'Sender',
        Page: '1',
      },
    });

    if (!counterpartyResponse.data || counterpartyResponse.data.length === 0) {
      console.error('❌ No sender counterparty found. Please create one in Nova Poshta cabinet first.');
      return;
    }

    const sender = counterpartyResponse.data[0];
    console.log('✅ Found sender counterparty:');
    console.log(`   Name: ${sender.Description}`);
    console.log(`   Type: ${sender.CounterpartyType}`);
    console.log(`   SENDER_REF: ${sender.Ref}`);

    // Get contact person
    let contactRef = null;
    if (sender.ContactPerson?.data?.[0]) {
      contactRef = sender.ContactPerson.data[0].Ref;
      console.log(`   Contact: ${sender.ContactPerson.data[0].Description}`);
      console.log(`   SENDER_CONTACT_REF: ${contactRef}`);
    } else {
      // Try fetching contacts separately
      console.log('\n📞 Fetching contact persons...');
      try {
        const contactsResponse = await fetchNovaPoshtaData({
          modelName: 'ContactPerson',
          calledMethod: 'getContactPersonsList',
          methodProperties: {
            Ref: sender.Ref,
            Page: '1',
          },
        });

        if (contactsResponse.data && contactsResponse.data.length > 0) {
          contactRef = contactsResponse.data[0].Ref;
          console.log(`   Contact: ${contactsResponse.data[0].Description}`);
          console.log(`   SENDER_CONTACT_REF: ${contactRef}`);
        }
      } catch (contactError) {
        console.log(`   ⚠️  No contact person found (this is normal for new accounts)`);
      }
    }

    // ============================================
    // 2. Fetch Sender Warehouses
    // ============================================
    console.log('\n📍 Step 2: Fetching your warehouses...');
    console.log('Please enter your city name (or press Enter to search all):');

    // For now, let's just fetch warehouses associated with the counterparty
    const warehouseResponse = await fetchNovaPoshtaData({
      modelName: 'Address',
      calledMethod: 'getWarehouses',
      methodProperties: {
        CounterpartyRef: sender.Ref,
        Page: '1',
      },
    });

    console.log('\n✅ Found warehouses:');
    if (warehouseResponse.data && warehouseResponse.data.length > 0) {
      warehouseResponse.data.forEach((warehouse, index) => {
        console.log(`\n   ${index + 1}. ${warehouse.Description}`);
        console.log(`      City: ${warehouse.CityDescription || 'N/A'}`);
        console.log(`      Ref: ${warehouse.Ref}`);
      });

      const firstWarehouseRef = warehouseResponse.data[0].Ref;

      // ============================================
      // 3. Print Summary
      // ============================================
      console.log('\n\n' + '='.repeat(70));
      console.log('📝 COPY THESE VALUES TO api/utilities/novaPoshta/senderConfig.ts');
      console.log('='.repeat(70));
      console.log('\nReplace the placeholder values with these:');
      console.log('\n  SENDER_REF: \'' + sender.Ref + '\',');
      console.log('  SENDER_WAREHOUSE_REF: \'' + firstWarehouseRef + '\',');
      if (contactRef) {
        console.log('  SENDER_CONTACT_REF: \'' + contactRef + '\',');
      } else {
        console.log('  SENDER_CONTACT_REF: \'<NEED TO CREATE CONTACT PERSON>\',');
      }
      console.log('\n' + '='.repeat(70));

      if (!contactRef) {
        console.log('\n⚠️  WARNING: No contact person found!');
        console.log('You need to create a contact person in your Nova Poshta cabinet.');
      }

      if (warehouseResponse.data.length > 1) {
        console.log('\n💡 TIP: You have multiple warehouses.');
        console.log('   Choose the one you want to use as your default sender address.');
      }

    } else {
      console.log('❌ No warehouses found for this counterparty.');
      console.log('You may need to add warehouses in your Nova Poshta cabinet.');

      // Try searching by cities
      console.log('\nSearching for warehouses in major cities...');

      const cities = ['Київ', 'Львів', 'Одеса', 'Харків', 'Дніпро'];
      for (const city of cities) {
        try {
          const cityWarehousesResponse = await fetchNovaPoshtaData({
            modelName: 'AddressGeneral',
            calledMethod: 'getWarehouses',
            methodProperties: {
              CityName: city,
              Limit: '3',
            },
          });

          if (cityWarehousesResponse.data && cityWarehousesResponse.data.length > 0) {
            console.log(`\n📍 Warehouses in ${city}:`);
            cityWarehousesResponse.data.slice(0, 3).forEach((w) => {
              console.log(`   ${w.Description} - Ref: ${w.Ref}`);
            });
          }
        } catch (err) {
          // Continue to next city
        }
      }

      console.log('\n💡 You can use any of these warehouse refs as SENDER_WAREHOUSE_REF');
    }

  } catch (error) {
    console.error('\n❌ Error fetching credentials:', error.message);
    process.exit(1);
  }
}

// Run the script
fetchSenderCredentials().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
