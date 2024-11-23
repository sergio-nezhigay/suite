import {
  ResourceList,
  Avatar,
  ResourceItem,
  Text,
  Button,
  Filters,
} from '@shopify/polaris';

import { useState, useEffect, useCallback } from 'react';
import CreateProductTest2 from './CreateProductTest2';

function ProductList({ products, debouncedQuery, setDebouncedQuery }) {
  const [query, setQuery] = useState(debouncedQuery);
  console.log('🚀 ~ products:', products);
  const [selectedItems, setSelectedItems] = useState([]);
  console.log('🚀 ~ selectedItems:', selectedItems);

  const promotedBulkActions = [
    {
      content: 'Edit customers',
      onAction: () => console.log('Todo: implement bulk edit', selectedItems),
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
                //appliedFilters={appliedFilters}
                onQueryChange={handleFiltersQueryChange}
                //onQueryClear={handleQueryValueRemove}
                //onClearAll={handleFiltersClearAll}
              />
            }
          />
          <CreateProductTest2
            products={products.filter(({ id }) => selectedItems.includes(id))}
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
