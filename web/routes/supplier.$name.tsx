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
} from '@shopify/polaris';

import { useState, useEffect } from 'react';
import CategorySelector from '../components/CategorySelector';

interface Product {
  id: string;
  name: string;
  pictures: string[];
  price: string | number;
  part_number: string;
  existsInShopify: boolean;
  instock: number;
}

interface FetchResponse {
  products: Product[];
  count: number;
}

const itemsPerPage = 50;

function Supplier() {
  const { supplierId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const brainCategory = searchParams.get('category') || '8410';
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

  const fetchData = async (
    query: string,
    signal: AbortSignal
  ): Promise<void> => {
    setLoading(true);
    try {
      const fetchUrl = `/supplier?query=${query}&page=${page}&limit=${itemsPerPage}&supplierId=${supplierId}&categoryId=${brainCategory}`;
      console.log('🚀 ~ fetchUrl:', fetchUrl);
      const response = await fetch(fetchUrl, { signal });
      if (!response.ok) {
        shopify.toast.show('Failed to fetch products. ' + response, {
          duration: 5000,
          isError: true,
        });
      }
      const result: FetchResponse = await response.json();

      setProducts(result.products);
      setTotalItems(result.count);
    } catch (error) {
      if ((error as any)?.name !== 'AbortError') {
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
      const response = await fetch('/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ products: productsToCreate }),
      });

      if (!response.ok) {
        let errorDetails = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorDetails = `HTTP ${response.status} - ${
            errorData.message || JSON.stringify(errorData)
          }`;
        } catch (e) {
          errorDetails = `HTTP ${response.status} - Unable to parse error response`;
        }
        throw new Error(`Failed to create products: ${errorDetails}`);
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
        duration: 30000,
        isError: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectionChange = (selected: string[]): void => {
    const selectableItems = products
      .filter((product) => !product.existsInShopify && product.instock > 0)
      .map((product) => product.id);
    setSelectedItems(selected.filter((id) => selectableItems.includes(id)));
  };

  const handleFiltersQueryChange = (value: string): void => {
    setSearchParams((prevParams) => {
      const newParams = new URLSearchParams(prevParams);
      newParams.set('query', value);
      newParams.set('page', '1');
      return newParams;
    });
  };

  const handleCategoryChange = (value: string): void => {
    setSearchParams((prevParams) => {
      const newParams = new URLSearchParams(prevParams);
      newParams.set('category', value);
      newParams.set('query', '');
      newParams.set('page', '1');
      return newParams;
    });
  };

  const handleNextPage = () => {
    setSearchParams((prevParams) => {
      const newParams = new URLSearchParams(prevParams);
      newParams.set('page', (page + 1).toString());
      return newParams;
    });
  };

  const handlePrevPage = () => {
    setSearchParams((prevParams) => {
      const newParams = new URLSearchParams(prevParams);
      newParams.set('page', Math.max(page - 1, 1).toString());
      return newParams;
    });
  };

  const handleClearAll = () => {
    setSearchParams((prevParams) => {
      const newParams = new URLSearchParams(prevParams);
      newParams.delete('query');
      newParams.delete('category');
      newParams.set('page', '1');
      return newParams;
    });
  };

  const handleQueryClear = () => {
    setSearchParams((prevParams) => {
      const newParams = new URLSearchParams(prevParams);
      newParams.delete('query'); // Clear the query parameter
      newParams.set('page', '1'); // Reset to the first page
      return newParams;
    });
  };

  console.log(products);
  return (
    <Page title={`${supplierId}, page ${page}. `}>
      {supplierId === 'brain' && (
        <CategorySelector
          selectedOption={brainCategory}
          setSelectedOption={handleCategoryChange}
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
        flushFilters={true}
        filterControl={
          <Filters
            queryValue={query}
            filters={[]}
            onQueryChange={handleFiltersQueryChange}
            queryPlaceholder='Пошук товару'
            loading={loading}
            onQueryClear={handleQueryClear}
            onClearAll={handleClearAll}
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

  function renderItem(item: Product, _: any, index: number): JSX.Element {
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

    const fontWeight: 'regular' | 'medium' | 'bold' | undefined =
      !existsInShopify && instock > 0 ? 'bold' : undefined;
    const mediaSize = 'large';
    const media = pictures?.[0] ? (
      <Thumbnail size={mediaSize} alt={name} source={pictures?.[0]} />
    ) : undefined;

    return (
      <ResourceItem
        id={id}
        media={media}
        sortOrder={index}
        disabled={existsInShopify || instock === 0}
        accessibilityLabel={`View details for ${name}`}
        verticalAlignment='center'
        onClick={() => {
          setSelectedItems((prevSelectedItems) =>
            prevSelectedItems.includes(id)
              ? prevSelectedItems.filter((selectedId) => selectedId !== id)
              : [...prevSelectedItems, id]
          );
        }}
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
