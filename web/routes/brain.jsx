import { Card, Text, Page, Banner, Pagination } from '@shopify/polaris';
import { useState, useEffect } from 'react';
import ProductList from '../components/ProductList';
import { useAuthenticate } from '../components/useAuthenticate';

export default function Brain() {
  const { loading, authResult, error, sid } = useAuthenticate();
  const [products, setProducts] = useState([]);
  const [productError, setProductError] = useState(null);
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(1);
  const itemsPerPage = 5;
  const category = '1181';

  useEffect(() => {
    const fetchProducts = async () => {
      if (!sid || !category) {
        setProductError('Missing required parameters.');
        return;
      }

      try {
        setProductError(null);

        const response = await fetch(
          `/brain-products?sid=${sid}&category=${category}&page=${page}&limit=${itemsPerPage}`
        );
        const result = await response.json();
        console.log('🚀 ~fetchProducts result:', result);

        if (response.ok) {
          setProducts(result?.list?.list);
          setTotalItems(result?.list?.count);
        } else {
          setProductError('Failed to fetch products. ' + result.error);
        }
      } catch (error) {
        console.log('🚀 ~ error:', error);
        setProductError('Error fetching products.');
      }
    };
    fetchProducts();
  }, [page, sid]);

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  return (
    <Page title='Authentication Test'>
      <Text variant='bodyMd'>Your SID: {sid}</Text>
      {/*<Button onClick={authenticate} loading={loading} primary>
        Authenticate
      </Button>*/}

      {error && <Banner status='critical'>{error}</Banner>}
      {authResult && (
        <Text>Authentication Result ok: {JSON.stringify(authResult)}</Text>
      )}
      <Text variant='heading2xl' as='h2'>
        Products
      </Text>

      {loading && !productError && <Text>Loading ...</Text>}
      {productError && <Banner status='critical'>{productError}</Banner>}

      {products.length > 0 && (
        <Card>
          {<ProductList products={products} />}
          {totalItems > itemsPerPage && (
            <Pagination
              hasPrevious={page > 1}
              hasNext={page * itemsPerPage < totalItems}
              onPrevious={() => handlePageChange(page - 1)}
              onNext={() => handlePageChange(page + 1)}
            />
          )}
        </Card>
      )}
    </Page>
  );
}
