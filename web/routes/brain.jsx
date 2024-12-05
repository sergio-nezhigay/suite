import { Text, Page } from '@shopify/polaris';
import { useState, useEffect } from 'react';

export default function Brain() {
  const [page, setPage] = useState(1);
  const itemsPerPage = 5;
  const category = '1181';

  useEffect(() => {
    const fetchProducts = async () => {
      const response = await fetch(`/brain-products`);

      const result = await response.json();
      console.log('🚀 ~ result:', result);
    };
    fetchProducts();
  }, []);

  return (
    <Page title='Authentication Test'>
      <Text variant='bodyMd'>test</Text>
    </Page>
  );
}
