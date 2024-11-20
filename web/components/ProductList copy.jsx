// ProductList.js
import { ResourceList, ResourceItem, Avatar, Text } from '@shopify/polaris';

import React, { useState } from 'react';

const promotedBulkActions = [
  {
    content: 'Edit customers',
    onAction: () => console.log('Todo: implement bulk edit'),
  },
];

function ProductList({ products }) {
  const [selectedItems, setSelectedItems] = useState([]);

  return (
    <ResourceList
      resourceName={{ singular: 'product', plural: 'products' }}
      items={products}
      promotedBulkActions={promotedBulkActions}
      selectedItems={selectedItems}
      onSelectionChange={setSelectedItems}
      resolveItemId={resolveItemIds}
      selectable
      renderItem={(product) => (
        <ResourceItem
          id={product.productID}
          media={
            <Avatar
              size='md'
              name={product.name}
              source={product?.pictures[0]}
            />
          }
        >
          <Text>{product.name}</Text>
        </ResourceItem>
      )}
    />
  );
}

function resolveItemIds({ id }) {
  return id;
}

export default ProductList;
