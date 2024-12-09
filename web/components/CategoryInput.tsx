import { Listbox, Combobox, Icon } from '@shopify/polaris';
import { SearchIcon } from '@shopify/polaris-icons';
import { useState, useCallback, useEffect } from 'react';
import { api } from '../api';

type Option = {
  value: string;
  label: string;
};

function ComboboxExample() {
  const [searchTerm, setSearchTerm] = useState('');
  const [unselectedOptions, setUnselectedOptions] = useState<Option[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | undefined>();
  const [availableOptions, setAvailableOptions] = useState(unselectedOptions);

  useEffect(() => {
    async function fetchCategories() {
      const data = await api.brainCategories.findMany({
        search: searchTerm,
      });

      if (data.length > 0) {
        const cats = data.map((option) => {
          const value = option?.categoryID || '';
          return {
            value: value.toString(),
            label: option?.name || '',
          };
        });
        setUnselectedOptions(cats);
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
        setAvailableOptions(unselectedOptions);
        return;
      }

      const filterRegex = new RegExp(escapeSpecialRegExCharacters(value), 'i');
      const resultOptions = unselectedOptions.filter((option) =>
        option.label.match(filterRegex)
      );
      setAvailableOptions(resultOptions);
    },
    [unselectedOptions, escapeSpecialRegExCharacters]
  );

  const updateSelection = useCallback(
    (selected: string) => {
      const matchedOption = availableOptions.find((option) => {
        return option.value.match(selected);
      });
      setSelectedOption(selected);
      setSearchTerm((matchedOption && matchedOption.label) || '');
    },
    [availableOptions]
  );

  const optionsMarkup =
    availableOptions.length > 0
      ? availableOptions.map((option) => {
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
    <div style={{ height: '225px' }}>
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
        {availableOptions.length > 0 ? (
          <Listbox onSelect={updateSelection}>{optionsMarkup}</Listbox>
        ) : null}
      </Combobox>
    </div>
  );
}

export default ComboboxExample;
