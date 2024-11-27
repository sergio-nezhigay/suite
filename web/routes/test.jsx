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
          title: 'Test',
        }),
      });

      const result = await response.json();
      console.log('🚀 ~ result:', result);
      setResult(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page title='Open ai'>
      {result && (
        <>
          <Banner status='success'>
            Open ai answered: <Text>Заголовок: {result?.message?.title}</Text>
          </Banner>
          <Banner status='success'>
            Open ai answered: <Text>{result?.message?.html}</Text>
          </Banner>
        </>
      )}
      <Button onClick={createProduct} loading={loading}>
        Create Product
      </Button>
      {error && <Banner status='critical'>{error}</Banner>}
    </Page>
  );
}
