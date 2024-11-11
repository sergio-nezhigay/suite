import { Page, Text, Button } from '@shopify/polaris';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { api } from '../api'; // Import the Gadget API client

export default function MyComponent() {
  const navigate = useNavigate();
  const [apiResponse, setApiResponse] = useState(null);

  const gadgetEnv = process.env.GADGET_ENV;
  const gadgetApp = process.env.GADGET_APP;

  const apiUrl = `https://${gadgetApp}${
    gadgetEnv === 'development' ? '--development' : ''
  }.gadget.app/products`;

  const handleApiTest = async () => {
    try {
      const response = await fetch(apiUrl);
      const data = await response.json();
      console.log(data.products);
      setApiResponse(data.products);
    } catch (error) {
      console.error('API call failed:', error);
      setApiResponse({ error: 'Failed to fetch data' });
    }
  };

  return (
    <Page
      title='Test'
      backAction={{
        content: 'Shop Information',
        onAction: () => navigate('/'),
      }}
    >
      <Text variant='bodyMd' as='p'>
        This is a simple test at Shopify Embedded App.
      </Text>

      <Button onClick={handleApiTest}>Bulk products API Call</Button>
      {apiResponse && (
        <Text variant='bodyMd' as='p'>
          API Response: {JSON.stringify(apiResponse)}
        </Text>
      )}
    </Page>
  );
}
