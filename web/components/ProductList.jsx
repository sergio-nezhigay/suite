import {
  ResourceList,
  Avatar,
  ResourceItem,
  Text,
  Filters,
} from '@shopify/polaris';

import { useState, useEffect, useCallback } from 'react';
//import CreateProductTest2 from './CreateProductTest2';

function ProductList({
  products,
  debouncedQuery,
  setDebouncedQuery,
  isLoading,
  totalItems,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
}) {
  const [query, setQuery] = useState(debouncedQuery);
  const [selectedItems, setSelectedItems] = useState([]);

  const updatedProducts = products
    .filter(({ id }) => selectedItems.includes(id))
    .map(({ name, vendor, description, pictures }) => ({
      title: name,
      vendor,
      description,
      pictures,
    }));

  const promotedBulkActions = [
    {
      content: 'Create selected products',
      onAction: async () => {
        console.log('Todo: implement bulk edit', selectedItems);
        await createProducts();
      },
    },
  ];

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedQuery(query); // Update debounced query after the delay
    }, 500);

    // Cleanup the timeout on each change
    return () => clearTimeout(timeoutId);
  }, [query]); // Only re-run the effect if the `query` changes

  // Handle query change
  const handleFiltersQueryChange = useCallback(
    (value) => {
      setQuery(value); // Set the query value, triggering the debounce effect
    },
    [setQuery]
  );

  const createProducts = async () => {
    console.log('createProducts updatedProducts=', updatedProducts);
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
  };

  return (
    <>
      {products?.length > 0 && (
        <>
          <ResourceList
            resourceName={{
              singular: 'product',
              plural: 'products',
            }}
            items={products}
            renderItem={renderItem}
            selectedItems={selectedItems}
            onSelectionChange={setSelectedItems}
            promotedBulkActions={promotedBulkActions}
            resolveItemId={resolveItemIds}
            filterControl={
              <Filters
                queryValue={query}
                filters={[]}
                onQueryChange={handleFiltersQueryChange}
              />
            }
            loading={isLoading}
            showHeader
            totalItemsCount={totalItems}
            pagination={{
              hasNext: hasNext,
              hasPrevious: hasPrevious,
              onPrevious: onPrevious,
              onNext: onNext,
            }}
          />
        </>
      )}
    </>
  );

  function renderItem(item, _, index) {
    const { id, name, pictures } = item;

    return (
      <ResourceItem
        id={id}
        media={<Avatar size='md' name={name} source={pictures[0]} />}
        sortOrder={index}
        accessibilityLabel={`View details for ${name}`}
      >
        <Text variant='bodyMd' fontWeight='bold' as='h3'>
          {name}
        </Text>
      </ResourceItem>
    );
  }

  function resolveItemIds({ id }) {
    return id;
  }
}

export default ProductList;
