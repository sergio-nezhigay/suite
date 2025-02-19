import { ProductOptions } from 'api/types';

type InputItem = {
  OptionID: string;
  OptionName: string;
  ValueID: string;
  ValueName: string;
  FilterID: string;
  FilterName: string;
};

export function convertArrayToObject(items: InputItem[]): ProductOptions {
  return items.reduce((acc, item) => {
    const { OptionName, OptionID, ValueName } = item;

    if (!acc[OptionID]) {
      acc[OptionID] = {
        name: OptionName,
        valueNames: [],
      };
    }

    acc[OptionID].valueNames.push(ValueName);

    return acc;
  }, {} as ProductOptions);
}
