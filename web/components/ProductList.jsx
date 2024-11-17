// ProductList.js
import { ResourceList, ResourceItem, Avatar, Text } from '@shopify/polaris';
import React from 'react';

function ProductList({ products }) {
  return (
    <ResourceList
      resourceName={{ singular: 'product', plural: 'products' }}
      items={products}
      renderItem={(product) => (
        <ResourceItem
          id={product.productID}
          media={
            <Avatar
              customer
              size='md'
              name={product.name}
              source={product.small_image}
            />
          }
        >
          <Text variant='bodyMd'>{product.name}</Text>
        </ResourceItem>
      )}
    />
  );
}

export default ProductList;
