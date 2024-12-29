import { Listbox, Combobox, Icon } from '@shopify/polaris';
import { SearchIcon } from '@shopify/polaris-icons';
import { useState, useCallback, useEffect } from 'react';
import { api } from '../api';

type Option = {
  value: string;
  label: string;
};

function CategorySelector({
  selectedOption,
  setSelectedOption,
}: {
  selectedOption: string;
  setSelectedOption: (value: string) => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [allOptions, setAllOptions] = useState<Option[]>([]);

  const escapeSpecialRegExCharacters = useCallback(
    (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    []
  );
  const filterRegex = new RegExp(escapeSpecialRegExCharacters(searchTerm), 'i');
  const limitedOptions =
    searchTerm === ''
      ? allOptions
      : allOptions.filter((option) => option.label.match(filterRegex));

  useEffect(() => {
    async function fetchCategories() {
      const data = await api.brainCategories.findMany({
        search: searchTerm,
      });

      if (data.length > 0) {
        const categories = data.map((option) => {
          const value = option?.categoryID || '';
          return {
            value: value.toString(),
            label: option?.name || '',
          };
        });
        setAllOptions(categories);
      }
    }
    fetchCategories();
  }, [searchTerm]);

  const updateText = useCallback(
    (value: string) => {
      setSearchTerm(value);
    },
    [allOptions, escapeSpecialRegExCharacters]
  );

  const updateSelection = useCallback(
    (selected: string) => {
      const matchedOption = limitedOptions.find((option) => {
        return option.value.match(selected);
      });

      setSelectedOption(selected);
      setSearchTerm((matchedOption && matchedOption.label) || '');
    },
    [limitedOptions]
  );

  const optionsMarkup =
    limitedOptions.length > 0
      ? limitedOptions.map((option) => {
          const { label, value } = option;

          return (
            <Listbox.Option
              key={`${value}`}
              value={value}
              selected={selectedOption === value}
              accessibilityLabel={label}
            >
              {label}
            </Listbox.Option>
          );
        })
      : null;

  return (
    <div style={{ height: '50px' }}>
      <Combobox
        activator={
          <Combobox.TextField
            prefix={<Icon source={SearchIcon} />}
            onChange={updateText}
            label='Виберіть категорію'
            labelHidden
            value={searchTerm}
            placeholder='Виберіть категорію'
            autoComplete='off'
          />
        }
      >
        {limitedOptions.length > 0 ? (
          <Listbox onSelect={updateSelection}>{optionsMarkup}</Listbox>
        ) : null}
      </Combobox>
    </div>
  );
}

export default CategorySelector;
