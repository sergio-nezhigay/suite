const promptTemplate = `
Оформіть цей опис українською мовою у стилі опису продукту Shopify для {{title}}.
Видаліть зайві заголовки, покращіть читабельність. Обов'язково використовуйте HTML-теги для кожної частини опису, що відповідає полю опису продукту Shopify, без додаткового тексту або коментарів.
Використовуйте простий, чіткий стиль для інформації про товар:

{{description}}

Очікую в результаті JSON об'єкт з 2 полями:
1. html: оформлений опис;
2. title: (строка) - Оптимальна назва товару українською мовою.
`;

export default function preparePrompt(
  title: string,
  description: string
): string {
  return promptTemplate
    .replace('{{title}}', title)
    .replace('{{description}}', description);
}
