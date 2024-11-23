//import {
//  ResourceList,
//  Avatar,
//  ResourceItem,
//  Text,
//  Filters,
//} from '@shopify/polaris';

//import { useState, useEffect, useCallback } from 'react';

//function ProductList({}) {
//  const initialQuery = 'кабель';
//  const [query, setQuery] = useState(initialQuery);
//  const [selectedItems, setSelectedItems] = useState([]);
//  const [products, setProducts] = useState([]);
//  const [productError, setProductError] = useState(null);
//  const [totalItems, setTotalItems] = useState(0);
//  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
//  const [page, setPage] = useState(1);

//  const [loading, setLoading] = useState(false);
//  const itemsPerPage = 7;

//  useEffect(() => {
//    const fetchProducts = async () => {
//      try {
//        setProductError(null);
//        setLoading(true);
//        const response = await fetch(
//          `/easy-products?query=${debouncedQuery}&page=${page}&limit=${itemsPerPage}`
//        );
//        const result = await response.json();

//        if (response.ok) {
//          setProducts(result.products);
//          setTotalItems(result.count);
//        } else {
//          setProductError('Failed to fetch products. ' + result.error);
//        }
//      } catch (error) {
//        console.log('🚀 ~ error:', error);
//        setProductError('Error fetching products.');
//      } finally {
//        setLoading(false);
//      }
//    };
//    fetchProducts();
//  }, [page, debouncedQuery]);

//  const updatedProducts = products
//    .filter(({ id }) => selectedItems.includes(id))
//    .map(({ name, vendor, description, pictures }) => ({
//      title: name,
//      vendor,
//      description,
//      pictures,
//    }));

//  const promotedBulkActions = [
//    {
//      content: 'Create selected products',
//      onAction: async () => {
//        console.log('Todo: implement bulk edit', selectedItems);
//        await createProducts();
//      },
//    },
//  ];

//  useEffect(() => {
//    const timeoutId = setTimeout(() => {
//      setDebouncedQuery(query);
//    }, 500);

//    return () => clearTimeout(timeoutId);
//  }, [query]);

//  const handleFiltersQueryChange = useCallback(
//    (value) => {
//      setQuery(value);
//    },
//    [setQuery]
//  );

//  const createProducts = async () => {
//    const response = await fetch('/products-create', {
//      method: 'POST',
//      headers: {
//        'Content-Type': 'application/json',
//      },
//      body: JSON.stringify({ products: updatedProducts }),
//    });

//    if (!response.ok) {
//      throw new Error('Failed to create products.');
//    }
//    const data = await response.json();
//  };

//  return (
//    <ResourceList
//      resourceName={{
//        singular: 'product',
//        plural: 'products',
//      }}
//      items={products}
//      renderItem={renderItem}
//      selectedItems={selectedItems}
//      onSelectionChange={setSelectedItems}
//      promotedBulkActions={promotedBulkActions}
//      resolveItemId={resolveItemIds}
//      filterControl={
//        <Filters
//          queryValue={query}
//          filters={[]}
//          onQueryChange={handleFiltersQueryChange}
//        />
//      }
//      loading={loading}
//      showHeader
//      totalItemsCount={totalItems}
//      pagination={{
//        hasNext: page * itemsPerPage < totalItems,
//        hasPrevious: page > 1,
//        onPrevious: () => setPage(page - 1),
//        onNext: () => setPage(page + 1),
//      }}
//    />
//  );

//  function renderItem(item, _, index) {
//    const { id, name, pictures } = item;

//    return (
//      <ResourceItem
//        id={id}
//        media={<Avatar size='md' name={name} source={pictures[0]} />}
//        sortOrder={index}
//        accessibilityLabel={`View details for ${name}`}
//      >
//        <Text variant='bodyMd' fontWeight='bold' as='h3'>
//          {name}
//        </Text>
//      </ResourceItem>
//    );
//  }

//  function resolveItemIds({ id }) {
//    return id;
//  }
//}

//export default ProductList;
