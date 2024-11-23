import {
  ResourceList,
  Avatar,
  ResourceItem,
  Text,
  Button,
} from '@shopify/polaris';

import { useState } from 'react';
import CreateProductTest2 from './CreateProductTest2';

function ProductList({ products }) {
  console.log('🚀 ~ products:', products);
  const [selectedItems, setSelectedItems] = useState([]);
  console.log('🚀 ~ selectedItems:', selectedItems);

  const promotedBulkActions = [
    {
      content: 'Edit customers',
      onAction: () => console.log('Todo: implement bulk edit', selectedItems),
    },
  ];

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
