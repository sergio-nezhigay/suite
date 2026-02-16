/**
 * Abbreviates Ukrainian company legal forms to save space in UI displays
 *
 * Common Ukrainian legal forms are replaced with standard abbreviations:
 * - ТОВАРИСТВО З ОБМЕЖЕНОЮ ВІДПОВІДАЛЬНІСТЮ → ТОВ
 * - ФІЗИЧНА ОСОБА - ПІДПРИЄМЕЦЬ → ФОП
 * - ПРИВАТНЕ ПІДПРИЄМСТВО → ПП
 * - АКЦІОНЕРНЕ ТОВАРИСТВО → АТ
 * - ВИРОБНИЧО-КОМЕРЦІЙНЕ ПІДПРИЄМСТВО → ВКП
 * - etc.
 *
 * @param name - The full company name to abbreviate
 * @returns The abbreviated company name with normalized whitespace
 */
export function abbreviateUkrainianCompanyName(name: string): string {
  if (!name || typeof name !== 'string') {
    return name || '';
  }

  const LEGAL_FORM_ABBREVIATIONS: Record<string, string> = {
    'ТОВАРИСТВО З ОБМЕЖЕНОЮ ВІДПОВІДАЛЬНІСТЮ': 'ТОВ',
    'ФІЗИЧНА ОСОБА - ПІДПРИЄМЕЦЬ': 'ФОП',
    'ФІЗИЧНА ОСОБА-ПІДПРИЄМЕЦЬ': 'ФОП',
    'ПРИВАТНЕ ПІДПРИЄМСТВО': 'ПП',
    'АКЦІОНЕРНЕ ТОВАРИСТВО': 'АТ',
    'ВИРОБНИЧО-КОМЕРЦІЙНЕ ПІДПРИЄМСТВО': 'ВКП',
    'КОМУНАЛЬНЕ ПІДПРИЄМСТВО': 'КП',
    'ДЕРЖАВНЕ ПІДПРИЄМСТВО': 'ДП',
    'ПУБЛІЧНЕ АКЦІОНЕРНЕ ТОВАРИСТВО': 'ПАТ',
    'ПРИВАТНЕ АКЦІОНЕРНЕ ТОВАРИСТВО': 'ПрАТ',
    'ТОВАРИСТВО З ДОДАТКОВОЮ ВІДПОВІДАЛЬНІСТЮ': 'ТДВ',
  };

  let abbreviated = name;

  // Replace all legal forms with abbreviations
  for (const [fullForm, abbreviation] of Object.entries(LEGAL_FORM_ABBREVIATIONS)) {
    abbreviated = abbreviated.replace(new RegExp(fullForm, 'g'), abbreviation);
  }

  // Normalize extra whitespace (multiple spaces, tabs, newlines)
  abbreviated = abbreviated.replace(/\s+/g, ' ').trim();

  return abbreviated;
}
