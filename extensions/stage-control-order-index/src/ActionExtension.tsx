/** @jsxImportSource preact */
import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { useCallback, useEffect, useState } from 'preact/hooks';
import {
  addOrderNote,
  getOrdersTags,
  updateOrdersTags,
} from '../../shared/shopifyOperations';
import { stages } from '../../shared/stages';

// Target: admin.order-index.selection-action.render (see ./shopify.extension.toml)
export default async () => {
  render(<App />, document.body);
};

function App() {
  const [value, setValue] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const { close, data } = shopify;
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
    <s-admin-action heading={getTitle()} loading={loading}>
      <s-stack>
        <s-select
          label={`Change order stage ${loading ? '(wait...)' : ''}`}
          value={value}
          onChange={(event) => handleChange(event.currentTarget.value)}
          disabled={loading}
        >
          {stages.map(({ value, label }) => (
            <s-option key={value} value={value}>
              {label}
            </s-option>
          ))}
        </s-select>
      </s-stack>
      <s-button
        slot='primary-action'
        onClick={async () => {
          await onSelect(value || '');
          close();
        }}
        disabled={loading}
      >
        Update
      </s-button>
    </s-admin-action>
  );
}
