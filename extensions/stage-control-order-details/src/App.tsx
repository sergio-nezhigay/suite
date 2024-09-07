import { useEffect, useState } from 'react';
import {
  reactExtension,
  useApi,
  AdminBlock,
  InlineStack,
  ProgressIndicator,
  Select,
  Form,
} from '@shopify/ui-extensions-react/admin';
import { getOrderTags, updateOrderTags } from '../../shared/shopifyOperations';
import { stages } from './stages';

const TARGET = 'admin.order-details.block.render';

export default reactExtension(TARGET, () => <App />);

function App() {
  const [loading, setLoading] = useState(true);
  const [value, setValue] = useState('');
  const { data } = useApi(TARGET);
  const orderId = data.selected[0].id;

  useEffect(() => {
    (async function getProductInfo() {
      const tags = await getOrderTags(orderId);
      const currentStage = (tags && tags[0]) || stages[0].value;
      setLoading(false);
      setValue(currentStage);
      await updateOrderTags({ value: currentStage, orderId });
    })();
  }, [orderId]);

  //  const onStageChange = async (value: string) => {
  //    setValue(value);
  //    await updateOrderTags({ value, orderId });
  //  };
  const onSubmit = async () => {
    await updateOrderTags({ value, orderId });
  };

  const onSelect = async (value: string) => {
    setValue(value);
  };

  return loading ? (
    <InlineStack blockAlignment='center' inlineAlignment='center'>
      <ProgressIndicator size='large-100' />
    </InlineStack>
  ) : (
    <AdminBlock>
      <Form onSubmit={onSubmit} onReset={() => {}}>
        <Select
          label='Change order stage'
          value={value}
          onChange={onSelect}
          options={stages}
        />
      </Form>
    </AdminBlock>
  );
}
