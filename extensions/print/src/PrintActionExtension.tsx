import { useEffect, useState } from 'react';
import {
  reactExtension,
  useApi,
  AdminPrintAction,
  BlockStack,
} from '@shopify/ui-extensions-react/admin';

const TARGET = 'admin.order-index.selection-print-action.render';

export default reactExtension(TARGET, () => <App />);

function App() {
  const { data } = useApi(TARGET);
  const [src, setSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!data.selected?.length) {
      setSrc(undefined);
      return;
    }

    const orderIds = data.selected.map((order) => order.id).join(',');
    const fullSrc = `/print?orderIds=${encodeURIComponent(orderIds)}`;

    console.log(fullSrc);
    setSrc(fullSrc);
  }, [data.selected]);

  return (
    <AdminPrintAction src={src}>
      <BlockStack blockGap='base'></BlockStack>
    </AdminPrintAction>
  );
}
