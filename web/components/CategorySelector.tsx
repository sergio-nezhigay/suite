import { Listbox, Combobox, Icon } from '@shopify/polaris';
import { SearchIcon } from '@shopify/polaris-icons';
import { useState, useCallback, useEffect } from 'react';
import { api } from '../api';

type Option = {
  value: string;
  label: string;
};

function ComboboxExample({
  selectedOption,
  setSelectedOption,
}: {
  selectedOption: string;
  setSelectedOption: (value: string) => {};
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [allOptions, setAllOptions] = useState<Option[]>([]);

  const [limitedBySearchOptions, setLimitedBySearchOptions] =
    useState(allOptions);

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

  const escapeSpecialRegExCharacters = useCallback(
    (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    []
  );

  const updateText = useCallback(
    (value: string) => {
      setSearchTerm(value);

      if (value === '') {
        setLimitedBySearchOptions(allOptions);
        return;
      }

      const filterRegex = new RegExp(escapeSpecialRegExCharacters(value), 'i');
      const resultOptions = allOptions.filter((option) =>
        option.label.match(filterRegex)
      );
      setLimitedBySearchOptions(resultOptions);
    },
    [allOptions, escapeSpecialRegExCharacters]
  );

  const updateSelection = useCallback(
    (selected: string) => {
      const matchedOption = limitedBySearchOptions.find((option) => {
        return option.value.match(selected);
      });

      setSelectedOption(selected);
      setSearchTerm((matchedOption && matchedOption.label) || '');
    },
    [limitedBySearchOptions]
  );

  const optionsMarkup =
    limitedBySearchOptions.length > 0
      ? limitedBySearchOptions.map((option) => {
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
            label='Search categories'
            labelHidden
            value={searchTerm}
            placeholder='Search categories'
            autoComplete='off'
          />
        }
      >
        {limitedBySearchOptions.length > 0 ? (
          <Listbox onSelect={updateSelection}>{optionsMarkup}</Listbox>
        ) : null}
      </Combobox>
    </div>
  );
}

export default ComboboxExample;
