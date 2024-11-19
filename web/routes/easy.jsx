import { Text, Page, Banner, Pagination, Select } from '@shopify/polaris';
import { useState, useEffect } from 'react';
import ProductList from '../components/ProductList';
import { CATEGORIES } from '../data/easybuyCategories';

export default function Easy() {
  const [products, setProducts] = useState([]);
  const [productError, setProductError] = useState(null);
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('90752735');
  const itemsPerPage = 7;
  const categoriesAndValues = CATEGORIES.map(({ value, label }) => ({
    value,
    label: `${label}: ${value}`,
  }));
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setProductError(null);
        shopify.loading(true);
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
      } finally {
        shopify.loading(false);
      }
    };
    fetchProducts();
  }, [page, category]);

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  return (
    <Page title='Easybuy Test'>
      <Select
        label='Select Category'
        options={categoriesAndValues}
        value={category}
        onChange={(value) => {
          setCategory(value);
          setPage(1);
        }}
      />
      <Text variant='heading2xl' as='h2'>
        Products. Page {page}
      </Text>

      {productError && <Banner status='critical'>{productError}</Banner>}

      {products.length > 0 && (
        <>
          {<ProductList products={products} />}
          {totalItems > itemsPerPage && (
            <Pagination
              hasPrevious={page > 1}
              hasNext={page * itemsPerPage < totalItems}
              onPrevious={() => handlePageChange(page - 1)}
              onNext={() => handlePageChange(page + 1)}
            />
          )}
        </>
      )}
    </Page>
  );
}
