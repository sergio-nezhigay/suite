import { useParams, useSearchParams } from 'react-router-dom';
import {
  ResourceList,
  ResourceItem,
  Text,
  Filters,
  InlineStack,
  Page,
  InlineGrid,
  Thumbnail,
  Box,
} from '@shopify/polaris';

import { useState, useEffect, useCallback } from 'react';
import CategorySelector from '../components/CategorySelector';

const itemsPerPage = 50;

function Supplier({}) {
  const { supplierId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedItems, setSelectedItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [brainCategory, setBrainCategory] = useState('1287');
  const page = Number(searchParams.get('page')) || 1;
  const query = searchParams.get('query') || '';
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

  const fetchData = async (query, signal) => {
    setLoading(true);
    try {
      const fetchUrl = `/supplier?query=${query}&page=${page}&limit=${itemsPerPage}&supplierId=${supplierId}&categoryId=${brainCategory}`;
      console.log('🚀 ~ fetchUrl:', fetchUrl);
      const response = await fetch(fetchUrl, { signal });
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
    .map(({ name, ...props }) => ({
      title: name,
      ...props,
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
                (product.existsInShopify && product.instock > 0) ||
                selectedItems.includes(product.id),
            };
          });
          return newProducts;
        });
        setSelectedItems([]);
      },
    },
  ];

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
        const error = JSON.stringify(response);
        console.log(error);
        shopify.toast.show('Failed to create' + error, {
          duration: 10000,
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
      console.log(error);
      shopify.toast.show('Error creating products' + error, {
        duration: 10000,
        isError: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectionChange = (selected) => {
    const selectableItems = products
      .filter((product) => !product.existsInShopify && product.instock > 0)
      .map((product) => product.id);
    setSelectedItems(selected.filter((id) => selectableItems.includes(id)));
  };

  const handleFiltersQueryChange = useCallback((value) => {
    setSearchParams((prevParams) => {
      const newParams = new URLSearchParams(prevParams);
      newParams.set('query', value);
      newParams.set('page', 1);
      return newParams;
    });
  }, []);

  const handleNextPage = () => {
    setSearchParams((prevParams) => {
      const newParams = new URLSearchParams(prevParams);
      newParams.set('page', page + 1);
      return newParams;
    });
  };

  const handlePrevPage = () => {
    setSearchParams((prevParams) => {
      const newParams = new URLSearchParams(prevParams);
      newParams.set('page', Math.max(page - 1, 1));
      return newParams;
    });
  };

  console.log(products);
  return (
    <Page title={`${supplierId}, page ${page}. `}>
      {supplierId === 'brain' && (
        <CategorySelector
          selectedOption={brainCategory}
          setSelectedOption={setBrainCategory}
        />
      )}
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
            queryPlaceholder='Пошук товару'
            loading={loading}
          />
        }
        loading={loading}
        totalItemsCount={totalItems}
        pagination={{
          hasNext: page * itemsPerPage < totalItems,
          hasPrevious: page > 1,
          onPrevious: handlePrevPage,
          onNext: handleNextPage,
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
      instock,
    } = item;
    const formattedPrice =
      instock === 0
        ? 0
        : typeof price === 'string'
        ? price.match(/\d+/)?.[0] || '0'
        : Math.floor(price || 0);

    const fontWeight = !existsInShopify && instock > 0 ? 'bold' : '';
    const mediaSize = 'large';
    const media = pictures?.[0] ? (
      <Thumbnail size={mediaSize} name={name} source={pictures?.[0]} />
    ) : null;

    return (
      <ResourceItem
        id={id}
        media={media}
        sortOrder={index}
        disabled={existsInShopify || instock === 0}
        accessibilityLabel={`View details for ${name}`}
        verticalAlignment='center'
      >
        <InlineGrid
          columns={['twoThirds', 'oneThird']}
          gap='100'
          alignItems='center'
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
