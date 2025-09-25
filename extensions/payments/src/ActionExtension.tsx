import { useEffect, useState } from 'react';
import {
  reactExtension,
  useApi,
  AdminAction,
  BlockStack,
  Button,
  Text,
} from '@shopify/ui-extensions-react/admin';

const TARGET = 'admin.order-index.selection-action.render';

export default reactExtension(TARGET, () => <App />);

function App() {
  const { close, data } = useApi(TARGET);
  console.log({ data });

  return (
    <AdminAction
      primaryAction={
        <Button
          onPress={() => {
            console.log('saving');
            close();
          }}
        >
          Done
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
        <Text fontWeight='bold'>Test Payments</Text>
      </BlockStack>
    </AdminAction>
  );
}
