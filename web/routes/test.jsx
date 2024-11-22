import { Page, Text, Button, Banner } from '@shopify/polaris';
import { useState } from 'react';

export default function Test() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const createProduct = async () => {
    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const response = await fetch('/test-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test Product',
          vendor: 'Test Vendor',
        }),
      });

      if (!response.ok) {
        throw new Error('An error occurred while creating the product');
      }

      const data = await response.json();
      setResult(data.product);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page title='Create Product Test'>
      {error && <Banner status='critical'>{error}</Banner>}
      {result && (
        <Banner status='success'>
          Product Created: <Text>{result.title}</Text> (ID: {result.id})
        </Banner>
      )}
      <Button onClick={createProduct} loading={loading}>
        Create Product
      </Button>
    </Page>
  );
}
