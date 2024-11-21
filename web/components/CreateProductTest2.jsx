import { Page, Text, Button, Banner } from '@shopify/polaris';
import { useState } from 'react';

export default function CreateProductTest2({ products }) {
  console.log('🚀 ~ CreateProductTest2 products:', products);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const updatedProducts = products.map(({ name }) => ({
    title: name,
    vendor: 'Vendor3',
  }));

  const createProduct = async () => {
    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const response = await fetch('/products-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ products: updatedProducts }),
      });

      if (!response.ok) {
        throw new Error('An unknown error occurred');
      }
      const data = await response.json();
      if (data.error) {
        console.err(data.details);
        throw new Error(data.error || 'An unknown error occurred');
      }
      setResult(data.status);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  if (products.length === 0) return null;

  return (
    <Page title='Create Product Test'>
      <Button primary loading={loading} onClick={createProduct}>
        Create Product
      </Button>
      {error && (
        <Banner status='critical' title='Error'>
          <p>{error}</p>
        </Banner>
      )}
      {result && (
        <Banner status='success' title='Success'>
          <p>{result}</p>
        </Banner>
      )}
    </Page>
  );
}
