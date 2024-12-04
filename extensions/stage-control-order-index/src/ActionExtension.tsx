import { useCallback, useEffect, useState } from 'react';
import {
  reactExtension,
  useApi,
  AdminAction,
  BlockStack,
  Button,
  Select,
} from '@shopify/ui-extensions-react/admin';
import { stages } from 'extensions/shared/stages';
import { getOrdersTags, updateOrdersTags } from './shopifyOperations';
import { addOrderNote } from 'shared/shopifyOperations';

const TARGET = 'admin.order-index.selection-action.render';

export default reactExtension(TARGET, () => <App />);

function App() {
  const [value, setValue] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const { close, data } = useApi(TARGET);
  const selectedOrders = data?.selected || [];
  const selectedIds = selectedOrders.map(({ id }) => id);

  useEffect(() => {
    async function fetchOrderTags() {
      const tags = await getOrdersTags(selectedIds);
      const currentStage = (tags && tags[0]) || '';
      setLoading(false);
      setValue(currentStage);
    }
    fetchOrderTags();
  }, [selectedIds]);

  const onSelect = useCallback(
    async (newValue: string) => {
      setLoading(true);
      await updateOrdersTags({ value: newValue, orderIds: selectedIds });
      setValue(newValue);
      const note = `Stage updated to "${newValue}"`;
      for (const id of selectedIds) {
        await addOrderNote({ orderId: id, note });
      }
      setLoading(false);
    },
    [value]
  );

  return (
    <AdminAction
      primaryAction={
        <Button
          onPress={() => {
            close();
          }}
          disabled={loading}
        >
          Close after selecting
        </Button>
      }
    >
      <BlockStack>
        <Select
          label={`Change order stage ${loading ? '(wait...)' : ''}`}
          value={value}
          onChange={onSelect}
          options={stages}
          disabled={loading}
        />
      </BlockStack>
    </AdminAction>
  );
}
