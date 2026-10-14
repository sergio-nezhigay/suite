/**
 * Test script to fetch Nova Poshta sender credentials
 *
 * Run this with: node test-nova-poshta-credentials.js
 * Make sure your dev server is running!
 */

const fetch = require('node-fetch');

// Your Gadget app URL - update if needed
const APP_URL = 'http://localhost:3000';

async function testFetchCredentials() {
  console.log('🔍 Fetching Nova Poshta sender credentials...\n');

  try {
    const response = await fetch(`${APP_URL}/nova-poshta/fetch-sender-credentials`);
    const data = await response.json();

    if (data.success) {
      console.log('✅ Success! Check your Gadget logs for detailed information.\n');
      console.log('Response:', JSON.stringify(data, null, 2));
    } else {
      console.log('❌ Error:', data.error);
    }
  } catch (error) {
    console.error('❌ Failed to fetch:', error instanceof Error ? error.message : error);
    console.log('\n⚠️  Make sure your Gadget dev server is running!');
    console.log('   Run: npm run dev');
  }
}

testFetchCredentials();
