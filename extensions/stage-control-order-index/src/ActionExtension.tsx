import { useCallback, useEffect, useState } from 'react';
import {
  reactExtension,
  useApi,
  AdminAction,
  BlockStack,
  Button,
  Select,
} from '@shopify/ui-extensions-react/admin';
import {
  addOrderNote,
  getOrdersTags,
  updateOrdersTags,
} from '../../shared/shopifyOperations';
import { stages } from '../../shared/stages';

const TARGET = 'admin.order-index.selection-action.render';

export default reactExtension(TARGET, () => <App />);

function App() {
  const [value, setValue] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const { close, data } = useApi(TARGET);
  const selectedOrders = data?.selected || [];
  const selectedIds = selectedOrders.map(({ id }) => id);
  const selectedIdsString = selectedIds.join(','); // Use string for dependency

  useEffect(() => {
    async function fetchOrderTags() {
      if (!initialLoadComplete && selectedIds.length > 0) {
        try {
          const tags = await getOrdersTags(selectedIds);
          const currentStage = (tags && tags[0]) || '';
          setValue(currentStage);
          setInitialLoadComplete(true);
        } catch (error) {
          console.error('Failed to fetch initial tags:', error);
          setInitialLoadComplete(true);
        } finally {
          setLoading(false);
        }
      }
    }

    fetchOrderTags();
  }, [selectedIdsString, initialLoadComplete]); // Use string instead of array

  const handleChange = useCallback((newValue: string) => {
    setValue(newValue);
  }, []);

  const onSelect = useCallback(
    async (newValue: string) => {
      const previousValue = value;
      setLoading(true);
      setError(null);

      try {
        await updateOrdersTags({ value: newValue, orderIds: selectedIds });
        setValue(newValue);
        const note = `Stage updated to "${newValue}"`;
        await Promise.all(
          selectedIds.map((id) => addOrderNote({ orderId: id, note }))
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to update order stage:', error);
        setError(`Save failed: ${errorMessage}`);
        setValue(previousValue);
        try {
          await Promise.all(
            selectedIds.map((id) =>
              addOrderNote({
                orderId: id,
                note: `Failed to change status to "${newValue}": ${errorMessage}`,
              })
            )
          );
        } catch (noteErr) {
          console.error('Failed to add failure notes:', noteErr);
        }
      } finally {
        setLoading(false);
      }
    },
    [selectedIds, value]
  );

  const getTitle = () => {
    if (error) return error;
    if (loading) return 'Saving changes...';
    return `Change order stage (${selectedIds.length} selected)`;
  };

  return (
    <AdminAction
      title={getTitle()}
      loading={loading}
      primaryAction={
        <Button
          onPress={async () => {
            await onSelect(value || '');
            close();
          }}
          disabled={loading}
        >
          Update
        </Button>
      }
    >
      <BlockStack>
        <Select
          label={`Change order stage ${loading ? '(wait...)' : ''}`}
          value={value}
          onChange={handleChange}
          options={stages}
          disabled={loading}
        />
      </BlockStack>
    </AdminAction>
  );
}
