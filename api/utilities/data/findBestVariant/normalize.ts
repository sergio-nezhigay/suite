import { transliterate } from '../transliterate';

export function normalizeForMatch(text: string): string {
  return transliterate(
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  )
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(text: string): string[] {
  const normalized = normalizeForMatch(text);
  return normalized ? normalized.split(' ') : [];
}

