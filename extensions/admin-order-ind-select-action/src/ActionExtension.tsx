import { useEffect } from 'react';
import {
  reactExtension,
  useApi,
  AdminAction,
  BlockStack,
  Button,
  Text,
} from '@shopify/ui-extensions-react/admin';
import {
  getOrdersTags,
  updateOrdersTags,
} from '../../shared/shopifyOperations';

// The target used here must match the target used in the extension's toml file (./shopify.extension.toml)
const TARGET = 'admin.order-index.selection-action.render';

export default reactExtension(TARGET, () => <App />);

function App() {
  // The useApi hook provides access to several useful APIs like i18n, close, and data.
  const { i18n, close, data } = useApi(TARGET);
  const selectedOrders = data?.selected || [];
  const selectedIds = selectedOrders.map(({ id }) => id);

  useEffect(() => {
    getOrdersTags(selectedIds);
  }, [selectedIds]);

  return (
    <AdminAction
      primaryAction={
        <Button
          onPress={() => {
            console.log('saving new');
            updateOrdersTags({ value: 'hello1', orderIds: selectedIds });
            close();
          }}
        >
          Change hello tag and close
        </Button>
      }
      secondaryAction={
        <Button
          onPress={() => {
            console.log('closing');
            close();
          }}
        >
          Close
        </Button>
      }
    >
      <BlockStack>
        {/* Set the translation values for each supported language in the locales directory */}
        <Text fontWeight='bold'>{i18n.translate('welcome', { TARGET })}</Text>
        <Text>selectedOrders : {JSON.stringify(data.selected)}</Text>
      </BlockStack>
    </AdminAction>
  );
}
