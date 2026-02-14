import { useCallback, useEffect, useState } from 'react';
import {
  reactExtension,
  useApi,
  AdminBlock,
  Select,
  Text,
  Badge,
} from '@shopify/ui-extensions-react/admin';

import {
  getOrdersTags,
  updateOrdersTags,
  addOrderNote,
} from '../../shared/shopifyOperations';
import { stages } from '../../shared/stages';

const TARGET = 'admin.order-details.block.render';

export default reactExtension(TARGET, () => <App />);

function App() {
  const [value, setValue] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { data } = useApi(TARGET);

  const orderId = data.selected[0].id;

  useEffect(() => {
    async function fetchOrderTags() {
      const tags = await getOrdersTags([orderId]);
      const currentStage = (tags && tags[0]) || '';
      setLoading(false);
      setValue(currentStage);
    }
    fetchOrderTags();
  }, [orderId]);

  const onSelect = useCallback(async (newValue: string) => {
    setLoading(true);
    setError(null);
    try {
      await updateOrdersTags({ value: newValue, orderIds: [orderId] });
      setValue(newValue);
      const note = `Stage updated to "${newValue}. "`;
      await addOrderNote({ orderId, note });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update';
      console.error('Update failed:', err);
      setError(message);
      try {
        await addOrderNote({
          orderId,
          note: `Failed to change status to "${newValue}": ${message}`,
        });
      } catch (noteErr) {
        console.error('Failed to add failure note:', noteErr);
      }
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  return (
    <AdminBlock>
      <Select
        label={`Order stage ${loading ? '(wait...)' : ''}`}
        value={value}
        onChange={onSelect}
        options={stages}
        disabled={loading}
      />
      {error && (
        <Badge tone='critical'>
          {error}
        </Badge>
      )}
    </AdminBlock>
  );
}
