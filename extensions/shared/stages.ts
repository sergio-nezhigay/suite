export const stages = [
  'Очікують оплати',
  'На утриманні',
  'Завершені',
  'Нетермінове дозамовлення',
  'Не додзв-2',
  'Не додзв-1',
  'Перевірити оплату',
  'Оплачено - на доставку',
  'Оформити РІ',
  'Оформити Че',
  'Оформити Ме',
  'Оформити Ии',
  'Зробити чеки',
  'Необхідне дозамовлення',
  'Накладений платіж',
  'Відправлено',
  'Скасовано',
].map((label) => ({
  value: label,
  label,
}));
