import { AdminBlock, Button, Text } from '@shopify/ui-extensions-react/admin';
import { useState } from 'react';
import { getWebPixels } from './createWebPixel';
//import { getWebPixel } from './createWebPixel';

export function YourComponent() {
  const [webPixels, setWebPixels] = useState<
    { id: string; settings: string }[]
  >([]);

  const handleGetWebPixels = async () => {
    console.log('Fetching1 current web pixels...');

    try {
      const webPixelsList = await getWebPixels();
      console.log('Web pixels fetched successfully:', webPixelsList);
      setWebPixels(webPixelsList); // Store the fetched web pixels in state
    } catch (error) {
      console.error('Error fetching web pixels:', error);
    }
  };

  return (
    <AdminBlock>
      <Button onPress={handleGetWebPixels}>View Current Web Pixels</Button>
      <Text>xedrtyu1eyh</Text>
    </AdminBlock>
  );
}
