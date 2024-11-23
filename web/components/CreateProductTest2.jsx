import { Page, Text, Button, Banner } from '@shopify/polaris';
import { useState } from 'react';

export default function CreateProductTest2({ products }) {
  console.log('🚀 ~CreateProductTest2 products:', products);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const updatedProducts = products.map(
    ({ name, vendor, description, pictures }) => ({
      title: name,
      vendor,
      description,
      pictures,
    })
  );

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
        throw new Error('Failed to create products.');
      }

      const data = await response.json();
      console.log('🚀 ~ data:', data);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page>
      <Button onClick={createProduct} loading={loading} primary>
        Create Products
      </Button>

      {error && (
        <Banner status='critical' title='Error'>
          <p>{error}</p>
        </Banner>
      )}

      {result && (
        <Banner status='success' title={result.message}>
          <ul>
            {result?.createdProducts.map((product) => (
              <li key={product.id}>
                {product.title} (Vendor: {product.vendor})
              </li>
            ))}
          </ul>
        </Banner>
      )}
    </Page>
  );
}
