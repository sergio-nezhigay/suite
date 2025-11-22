import {
  reactExtension,
  useApi,
  AdminBlock,
  BlockStack,
  Text,
  TextField,
  Button,
  Banner,
} from '@shopify/ui-extensions-react/admin';
import { useState, useEffect } from 'react';

// The target used here must match the target used in the extension's toml file (./shopify.extension.toml)
const TARGET = 'admin.order-details.block.render';

export default reactExtension(TARGET, () => <App />);

function App() {
  const { i18n, data } = useApi(TARGET);
  const orderId = data.selected[0]?.id;

  const [note, setNote] = useState('');
  const [initialNote, setInitialNote] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    fetchOrderNote(orderId);
  }, [orderId]);

  async function fetchOrderNote(id: string) {
    setIsLoading(true);
    setError(null);
    try {
      const query = `query Order($id: ID!) {
        order(id: $id) {
          note
        }
      }`;
      const response = await makeGraphQLQuery(query, { id });
      const fetchedNote = response.data?.order?.note || '';
      setNote(fetchedNote);
      setInitialNote(fetchedNote);
    } catch (err) {
      setError('Failed to load order note');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const mutation = `mutation orderUpdate($input: OrderInput!) {
        orderUpdate(input: $input) {
          order {
            note
          }
          userErrors {
            field
            message
          }
        }
      }`;
      const response = await makeGraphQLQuery(mutation, {
        input: {
          id: orderId,
          note: note,
        },
      });

      if (response.data?.orderUpdate?.userErrors?.length) {
        const errors = response.data.orderUpdate.userErrors
          .map((e: any) => e.message)
          .join(', ');
        throw new Error(errors);
      }

      setInitialNote(note);
      setSuccess('Note updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update note');
    } finally {
      setIsSaving(false);
    }
  }

  async function makeGraphQLQuery(query: string, variables: any) {
    const res = await fetch('shopify:admin/api/graphql.json', {
      method: 'POST',
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error('Network error');
    return await res.json();
  }

  return (
    <AdminBlock title="Order Editor">
      <BlockStack>
        {error && <Banner tone="critical">{error}</Banner>}
        {success && <Banner tone="success">{success}</Banner>}

        <TextField
          label="Order Note"
          value={note}
          onChange={setNote}
          disabled={isLoading || isSaving}
        />

        <Button
          onPress={handleSave}
          disabled={isLoading || isSaving || note === initialNote}
        >
          {isSaving ? 'Saving...' : 'Save Note'}
        </Button>
      </BlockStack>
    </AdminBlock>
  );
}
