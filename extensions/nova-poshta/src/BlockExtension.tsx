// extensions/nova-poshta/src/BlockExtension.tsx
import {
  reactExtension,
  useApi,
  AdminBlock,
  BlockStack,
  Text,
  Button,
  InlineStack,
  Banner,
} from '@shopify/ui-extensions-react/admin';
import { useState } from 'react';

const TARGET = 'admin.order-details.block.render';

export default reactExtension(TARGET, () => <App />);

// Define the User type based on JSONPlaceholder response
interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  website: string;
  company: {
    name: string;
  };
}

function App() {
  const { i18n, data } = useApi(TARGET);
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState<User | null>(null); // ✅ Add type
  const [error, setError] = useState<string | null>(null); // ✅ Add type

  console.log({ data });

  const handleFetchUser = async () => {
    setLoading(true);
    setError(null);

    try {
      // Call your Gadget backend route (relative URL)
      const response = await fetch('/nova-poshta/fetch-user-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 1, // JSONPlaceholder user ID
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setUserData(result.data);
      } else {
        setError(result.error || 'Failed to fetch user data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminBlock title='Nova Poshta - User Lookup'>
      <BlockStack>
        <Text fontWeight='bold'>
          {i18n.translate('welcome', { target: TARGET })}
        </Text>

        {/* Fetch User Button */}
        <InlineStack>
          <Button onPress={handleFetchUser} disabled={loading}>
            {loading ? 'Loading...' : 'Fetch User from JSONPlaceholder'}
          </Button>
        </InlineStack>

        {/* Error Display */}
        {error && <Banner tone='critical'>{error}</Banner>}

        {/* User Data Display */}
        {userData && (
          <BlockStack>
            <Banner tone='success'>User data fetched successfully!</Banner>

            <Text fontWeight='bold'>User Information:</Text>
            <Text>Name: {userData.name}</Text>
            <Text>Email: {userData.email}</Text>
            <Text>Phone: {userData.phone}</Text>
            <Text>Company: {userData.company.name}</Text>
            <Text>Website: {userData.website}</Text>
          </BlockStack>
        )}
      </BlockStack>
    </AdminBlock>
  );
}
