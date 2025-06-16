import {
  reactExtension,
  useApi,
  AdminAction,
  Button,
  InlineStack,
  Text,
} from '@shopify/ui-extensions-react/admin';
import { SHOPIFY_APP_URL } from 'extensions/shared/data';

const TARGET = 'admin.product-index.selection-action.render';

type Product = {
  id: string;
  title: string;
  description: string;
};

type QueryResult = {
  data?: {
    nodes?: Product[];
  };
};

export default reactExtension(TARGET, () => <App />);

function App() {
  const { data, close, query } = useApi(TARGET);
  const selectedProducts = data.selected ?? [];

  const handlePrimary = async () => {
    try {
      const productIds = selectedProducts
        .map((product) => `"${product.id}"`)
        .join(', ');

      const getProductsQuery = `
        query getProducts {
          nodes(ids: [${productIds}]) {
            ... on Product {
              id
              title
              description
            }
          }
        }
      `;

      const queryResult = (await query(getProductsQuery)) as QueryResult;
      console.log('result', JSON.stringify(queryResult, null, 2));

      if (queryResult?.data?.nodes) {
        const response = await fetch(
          `${SHOPIFY_APP_URL}/update-product-types`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              products: queryResult.data.nodes.map((product) => ({
                id: product.id,
                title: product.title,
                description: product.description,
              })),
            }),
          }
        );
        console.log('response', JSON.stringify(response, null, 2));
        if (!response.ok) {
          throw new Error('Failed to update product types');
        }

        const responseData = await response.json();
        console.log('Update response:', responseData);
      }
    } catch (error) {
      console.error('Error fetching product data:', error);
      console.log('Selected product IDs:', selectedProducts);
    }

    close();
  };

  return (
    <AdminAction
      title={`Run on ${selectedProducts.length} product(s)`}
      primaryAction={
        <Button onPress={handlePrimary}>
          Update types based on title and description
        </Button>
      }
      secondaryAction={<Button onPress={close}>Cancel</Button>}
      loading={false}
    >
      <InlineStack>
        <Text>
          This will log the titles of the selected products to the console.
        </Text>
      </InlineStack>
    </AdminAction>
  );
}
