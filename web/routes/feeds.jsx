import { Page, Text, Button } from '@shopify/polaris';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function Feeds() {
  const navigate = useNavigate();
  const [feedResponse, setFeedResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const gadgetEnv = process.env.GADGET_ENV;
  const gadgetApp = process.env.GADGET_APP;

  const apiUrl = `https://${gadgetApp}${
    gadgetEnv === 'development' ? '--development' : ''
  }.gadget.app/feeds`;

  const handleFeedGeneration = async () => {
    setLoading(true);
    try {
      const response = await fetch(apiUrl);

      const data = await response.json();
      console.log('Feed creation response:', data);
      setFeedResponse(data);
    } catch (error) {
      console.error('Feed generation failed:', error);
      setFeedResponse('Failed to generate feed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page
      title='Product Feed Test'
      backAction={{
        content: 'Shop Information',
        onAction: () => navigate('/'),
      }}
    >
      <Button onClick={handleFeedGeneration} loading={loading}>
        Generate Product Feed.
      </Button>

      {feedResponse && (
        <Text variant='bodyMd' as='p'>
          Feed Generation Response: {JSON.stringify(feedResponse)}
        </Text>
      )}
    </Page>
  );
}
