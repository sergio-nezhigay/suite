import { Page, Text, Button, Banner } from '@shopify/polaris';
import { useState, useEffect } from 'react';
import ProductList from '../components/ProductList';

export default function Brain() {
  const [loading, setLoading] = useState(false);
  const [authResult, setAuthResult] = useState(null);
  const [error, setError] = useState(null);
  const [sid, setSid] = useState(localStorage.getItem('sid') || null);
  const [category, setCategory] = useState('1181');
  const [products, setProducts] = useState([]);
  const [productError, setProductError] = useState(null);

  useEffect(() => {
    if (sid) {
      localStorage.setItem('sid', sid);
    } else {
      authenticate();
    }
  }, [sid]);

  const authenticate = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/auth-brain', {
        method: 'POST',
      });

      const result = await response.json();
      if (!response.ok) {
        setError(`Error: ${result.error}`);
        setAuthResult(null);
      } else {
        setAuthResult(JSON.stringify(result));
        setSid(result.sid);
      }
    } catch (err) {
      setError(`Error: ${result.error} (Details: ${result.details})`);
      setAuthResult(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    if (!sid || !category) {
      setProductError('Missing required parameters.');
      return;
    }

    try {
      setLoading(true);
      setProductError(null);

      const response = await fetch(
        `/brain-products?sid=${sid}&category=${category}`
      );
      const result = await response.json();
      console.log('🚀 ~fetchProducts result:', result);

      if (response.ok) {
        setProducts(result.list);
      } else {
        setProductError('Failed to fetch products.');
      }
    } catch (error) {
      setProductError('Error fetching products.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page title='Authentication Test'>
      <Text variant='bodyMd'>Your SID: {sid}</Text>
      <Button onClick={authenticate} loading={loading} primary>
        Authenticate
      </Button>

      {error && <Banner status='critical'>{error}</Banner>}
      {authResult && (
        <Text>Authentication Result ok: {JSON.stringify(authResult)}</Text>
      )}
      <Text variant='heading2xl' as='h2'>
        Products
      </Text>
      <Button onClick={fetchProducts} loading={loading}>
        Fetch Products
      </Button>

      {/* Product Display */}
      {loading && !productError && <Text>Loading ...</Text>}
      {productError && <Banner status='critical'>{productError}</Banner>}
      {products.length > 0 && <ProductList products={products} />}
    </Page>
  );
}
