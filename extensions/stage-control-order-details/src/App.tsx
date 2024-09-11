import { useCallback, useEffect, useState } from 'react';
import {
  reactExtension,
  useApi,
  AdminBlock,
  Select,
  Button,
} from '@shopify/ui-extensions-react/admin';
import {
  getOrdersTags,
  updateOrdersTags,
} from '../../shared/shopifyOperations';
import { stages } from './stages';
import { createWebPixel } from './createWebPixel';
import { YourComponent } from './YourComponent';

const TARGET = 'admin.order-details.block.render';

export default reactExtension(TARGET, () => <App />);

function App() {
  const [value, setValue] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
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
    setValue(newValue);
    await updateOrdersTags({ value: newValue, orderIds: [orderId] });
    setLoading(false);
  }, []);

  const handleCreateWebPixel = async () => {
    console.log('onPress event');

    try {
      const accountID = '123';
      const webPixel = await createWebPixel(accountID);
      console.log('Web pixel created successfully:', webPixel);
    } catch (error) {
      console.error('Error creating web pixel:', error);
    }
  };

  return (
    <AdminBlock>
      <Select
        label={`Order stage ${loading ? '(wait...)' : ''}`}
        value={value}
        onChange={onSelect}
        options={stages}
        disabled={loading}
      />
      <Button onPress={handleCreateWebPixel}>Click here2</Button>
      <YourComponent />
    </AdminBlock>
  );
}
