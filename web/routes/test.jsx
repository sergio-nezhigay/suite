import { Page, Button } from '@shopify/polaris';
import { useState } from 'react';
import CategorySelector from '../components/CategorySelector';

export default function Test() {
  const [selectedOption, setSelectedOption] = useState('');
  return (
    <Page title='Test'>
      <CategorySelector
        selectedOption={selectedOption}
        setSelectedOption={setSelectedOption}
      />
      <Button>test {selectedOption}</Button>
    </Page>
  );
}
