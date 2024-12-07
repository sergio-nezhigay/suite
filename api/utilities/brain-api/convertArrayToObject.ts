type InputItem = {
  OptionID: string;
  OptionName: string;
  ValueID: string;
  ValueName: string;
  FilterID: string;
  FilterName: string;
};

type OutputObject = Record<string, string[]>;

export function convertArrayToObject(items: InputItem[]): OutputObject {
  return items.reduce((acc, item) => {
    const { OptionName, ValueName } = item;

    if (!acc[OptionName]) {
      acc[OptionName] = [];
    }

    acc[OptionName].push(ValueName);

    return acc;
  }, {} as OutputObject);
}
