import { useParams } from 'react-router-dom';
import {
  ResourceList,
  ResourceItem,
  Text,
  Filters,
  InlineStack,
  Page,
  InlineGrid,
  Thumbnail,
} from '@shopify/polaris';

import { useState, useEffect, useCallback } from 'react';

const itemsPerPage = 50;

function Supplier({}) {
  const { supplierId } = useParams();

  const [query, setQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [totalItems, setTotalItems] = useState(0);

  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const debounceTimeout = setTimeout(() => {
      fetchData(query, controller.signal);
    }, 300);

    return () => {
      clearTimeout(debounceTimeout);
      controller.abort();
    };
  }, [query, page, supplierId]);

  useEffect(() => {
    setPage(1);
  }, [query, supplierId]);

  const fetchData = async (query, signal) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/supplier?query=${query}&page=${page}&limit=${itemsPerPage}&supplierId=${supplierId}`,
        { signal }
      );
      if (!response.ok) {
        shopify.toast.show('Failed to fetch products. ' + result.error, {
          duration: 5000,
          isError: true,
        });
      }
      const result = await response.json();

      setProducts(result.products);
      setTotalItems(result.count);
    } catch (error) {
      if (error.name !== 'AbortError') {
        shopify.toast.show('Failed to fetch products. ' + error, {
          duration: 5000,
          isError: true,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const productsToCreate = products
    .filter(({ id }) => selectedItems.includes(id))
    .map(({ name, vendor, description, pictures, part_number }) => ({
      title: name,
      vendor,
      description,
      pictures,
      part_number,
    }));

  const promotedBulkActions = [
    {
      content: 'Create selected',
      onAction: async () => {
        await createProducts();
        setProducts((prevProducts) => {
          const newProducts = prevProducts.map((product) => {
            return {
              ...product,
              existsInShopify:
                product.existsInShopify || selectedItems.includes(product.id),
            };
          });
          return newProducts;
        });
        setSelectedItems([]);
      },
    },
  ];

  const handleFiltersQueryChange = useCallback(
    (value) => {
      setQuery(value);
    },
    [setQuery]
  );

  const createProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/products/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ products: productsToCreate }),
      });

      if (!response.ok) {
        shopify.toast.show(error + 'Failed to create products.', {
          duration: 5000,
          isError: true,
        });
      }
      const data = await response.json();
      shopify.toast.show(
        data.createdProducts.length + ' products successfully created',
        {
          duration: 5000,
        }
      );
    } catch (error) {
      shopify.toast.show(error + ' Error creating products', {
        duration: 5000,
        isError: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectionChange = (selected) => {
    const selectableItems = products
      .filter((product) => !product.existsInShopify)
      .map((product) => product.id);
    setSelectedItems(selected.filter((id) => selectableItems.includes(id)));
  };

  console.log(products);
  return (
    <Page title={`${supplierId}, page ${page}`}>
      <ResourceList
        resourceName={{
          singular: 'product',
          plural: 'products',
        }}
        items={products}
        renderItem={renderItem}
        selectedItems={selectedItems}
        onSelectionChange={handleSelectionChange}
        promotedBulkActions={promotedBulkActions}
        resolveItemId={(id) => id}
        flushFilters={true}
        filterControl={
          <Filters
            queryValue={query}
            filters={[]}
            onQueryChange={handleFiltersQueryChange}
          />
        }
        loading={loading}
        totalItemsCount={totalItems}
        pagination={{
          hasNext: page * itemsPerPage < totalItems,
          hasPrevious: page > 1,
          onPrevious: () => setPage(page - 1),
          onNext: () => setPage(page + 1),
        }}
        hasMoreItems={totalItems > products.length}
      />
    </Page>
  );

  function renderItem(item, _, index) {
    const {
      id,
      name,
      pictures,
      price = 0,
      part_number,
      existsInShopify,
    } = item;
    const formattedPrice =
      typeof price === 'string'
        ? price.match(/\d+/)?.[0] || '0'
        : Math.floor(price || 0);
    const fontWeight = existsInShopify ? '' : 'bold';
    const mediaSize = existsInShopify ? 'large' : 'large';
    const media = pictures?.[0] ? (
      <Thumbnail size={mediaSize} name={name} source={pictures?.[0]} />
    ) : null;

    return (
      <ResourceItem
        id={id}
        media={media}
        sortOrder={index}
        disabled={existsInShopify}
        accessibilityLabel={`View details for ${name}`}
      >
        <InlineGrid
          columns={['twoThirds', 'oneThird']}
          gap='200'
          alignItems='center'
          align=''
        >
          <Text variant='bodyMd' fontWeight={fontWeight} as='h3'>
            {name}
          </Text>
          <InlineStack wrap={false} align='space-between' gap='100'>
            <Text variant='bodyMd' fontWeight={fontWeight} as='h3'>
              {part_number}
            </Text>
            <Text variant='bodyMd' fontWeight={fontWeight} as='h3'>
              {formattedPrice}
            </Text>
          </InlineStack>
        </InlineGrid>
      </ResourceItem>
    );
  }
}

export default Supplier;
