import { useCallback, useEffect, useState } from 'react';
import {
  reactExtension,
  useApi,
  AdminBlock,
  Select,
} from '@shopify/ui-extensions-react/admin';
import {
  getOrdersTags,
  updateOrdersTags,
} from '../../shared/shopifyOperations';
import { stages } from './stages';

const TARGET = 'admin.order-details.block.render';

export default reactExtension(TARGET, () => <App />);

function App() {
  const [value, setValue] = useState<string | null>(null);
  const [loading, setLoading] = useState<Boolean>(false);
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
  }, []);

  const onSelect = useCallback(async (newValue: string) => {
    setLoading(true);
    setValue(newValue);
    await updateOrdersTags({ value: newValue, orderIds: [orderId] });
    setLoading(false);
  }, []);

  return (
    <AdminBlock>
      <Select
        label='Order stage'
        value={value}
        onChange={onSelect}
        options={stages}
        disabled={Boolean(loading)}
      />
    </AdminBlock>
  );
}
