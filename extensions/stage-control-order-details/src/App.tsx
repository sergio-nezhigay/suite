/** @jsxImportSource preact */
import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { useCallback, useEffect, useState } from 'preact/hooks';

import {
  getOrdersTags,
  updateOrdersTags,
  addOrderNote,
} from '../../shared/shopifyOperations';
import { findStage, stages } from '../../shared/stages';

// Target: admin.order-details.block.render (see ./shopify.extension.toml)
export default async () => {
  render(<App />, document.body);
};

function App() {
  const [value, setValue] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { data } = shopify;

  const orderId = data.selected[0].id;

  useEffect(() => {
    async function fetchOrderTags() {
      try {
        const tags = await getOrdersTags([orderId]);
        setValue(findStage(tags));
      } catch (err) {
        console.error('Failed to fetch order tags:', err);
        setError('Failed to load stage');
      } finally {
        setLoading(false);
      }
    }
    fetchOrderTags();
  }, [orderId]);

  const onSelect = useCallback(async (newValue: string) => {
    if (!newValue) return;
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
    <s-admin-block>
      <s-select
        label={`Order stage ${loading ? '(wait...)' : ''}`}
        value={value}
        onChange={(event) => onSelect(event.currentTarget.value)}
        disabled={loading}
      >
        <s-option value=''>— Не вибрано —</s-option>
        {stages.map(({ value, label }) => (
          <s-option key={value} value={value}>
            {label}
          </s-option>
        ))}
      </s-select>
      {error && <s-badge tone='critical'>{error}</s-badge>}
    </s-admin-block>
  );
}
