import {
  LegacyCard,
  ResourceList,
  Avatar,
  ResourceItem,
  Text,
} from '@shopify/polaris';

import { useState } from 'react';

function ProductList({ products }) {
  const [selectedItems, setSelectedItems] = useState([]);

  const resourceName = {
    singular: 'customer',
    plural: 'customers',
  };

  const promotedBulkActions = [
    {
      content: 'Edit customers',
      onAction: () => console.log('Todo: implement bulk edit', selectedItems),
    },
  ];

  return (
    <>
      <LegacyCard>
        <ResourceList
          resourceName={resourceName}
          items={products}
          renderItem={renderItem}
          selectedItems={selectedItems}
          onSelectionChange={setSelectedItems}
          promotedBulkActions={promotedBulkActions}
          resolveItemId={resolveItemIds}
        />
      </LegacyCard>
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
