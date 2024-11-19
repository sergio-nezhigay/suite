import { Card, Text, Page, Banner, Pagination } from '@shopify/polaris';
import { useState, useEffect } from 'react';
import ProductList from '../components/ProductList';

export default function Easy() {
  const [products, setProducts] = useState([]);
  const [productError, setProductError] = useState(null);
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(1);
  const category = 89100038;
  const itemsPerPage = 5;

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setProductError(null);

        const response = await fetch(
          `/easy-products?category=${category}&page=${page}&limit=${itemsPerPage}`
        );
        const result = await response.json();
        console.log('🚀 ~fetchProducts result:', result);

        if (response.ok) {
          setProducts(result?.list);
          setTotalItems(result?.count);
        } else {
          setProductError('Failed to fetch products. ' + result.error);
        }
      } catch (error) {
        console.log('🚀 ~ error:', error);
        setProductError('Error fetching products.');
      }
    };
    fetchProducts();
  }, [page]);

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  return (
    <Page title='Easybuy Test'>
      <Text variant='heading2xl' as='h2'>
        Products
      </Text>

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
