const labels = [
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
  'Декларації',
  'Скасовано',
  'Дубльовано',
];

// Returns the first tag that is a known stage, or '' if none
export function findStage(tags: string[] | undefined): string {
  return tags?.find((tag) => labels.includes(tag)) || '';
}

export const STAGE_NAMES = {
  RI: 'Оформити РІ',
  CHE: 'Оформити Че',
  ME: 'Оформити Ме',
  II: 'Оформити Ии',
} as const;

export type StageOption = { value: string; label: string };
export type StagesType = StageOption[] & typeof STAGE_NAMES;

export const stages: StagesType = Object.assign(
  labels.map((label) => ({
    value: label,
    label,
  })),
  STAGE_NAMES
);



