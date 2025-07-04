const promptTemplate = `
Створи опис та назву товару українською для Shopify на основі:
1. Назва товару: "{{title}}".
2. Опис: "{{description}}".

**Вимоги**:
- Видали фрази про консультації, гарантію, "купуйте уважно" та відхилення.
- Опис має містити HTML (h2/h3/p/ul/li):
  - Перший блок — один короткий параграф з описом товару (без заголовка).
  - Другий блок - характеристики (при відсутності скомпонуй з наявної інформації). При наявності інформації додай в характеристики пункти про виробника та p/n, при відсутності ці пункти не потрібні.

  Для товарів "модулі пам'яті" бажано заповнити такі характеристики: виробник, тип товару, призначення, формфактор, стандарт пам'яті, тип пам'яті, схема таймінгів, частота пам'яті, об'єм пам'яті, напруга живлення.

  - Третій (необов'язковий) блок - Комплектація.

**Результат**: JSON з полями:
1. **html**: оформлений опис.
2. **title**: коротка назва, включаюча код.
`;

export function preparePrompt(title: string, description: string): string {
  return promptTemplate
    .replace('{{title}}', title)
    .replace('{{description}}', description);
}
