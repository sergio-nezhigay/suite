import { Page, Text, Button, Banner } from '@shopify/polaris';
import { useState } from 'react';

export default function Test() {
  const [loading, setLoading] = useState(false);
  const [authResult, setAuthResult] = useState(null);
  const [error, setError] = useState(null);

  const onClick = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/auth-brain', {
        method: 'POST',
      });

      const result = await response.json();
      if (!response.ok) {
        setError(`Error: ${result.error} (Details: ${result.details})`);
        setAuthResult(null);
      } else {
        setAuthResult(JSON.stringify(result));
      }
    } catch (err) {
      setError(`Error: ${result.error} (Details: ${result.details})`);
      setAuthResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page title='Authentication Test'>
      <Button onClick={onClick} loading={loading} primary>
        Authenticate
      </Button>
      {error && <Banner status='critical'>{error}</Banner>}
      {authResult && (
        <Text>Authentication Result ok: {JSON.stringify(authResult)}</Text>
      )}
    </Page>
  );
}
