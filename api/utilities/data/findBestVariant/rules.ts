import { normalizeForMatch } from './normalize';
import type { BestVariantMatch } from './types';

function containsAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(normalizeForMatch(term)));
}

function hasThreeMeterHint(rawText: string, normalizedText: string): boolean {
  return (
    /(^|[^a-z0-9])3\s*(?:m|м|meter|metre|метр(?:и|ів)?)\b/.test(rawText) ||
    /\b3m\b/.test(rawText) ||
    containsAny(normalizedText, ['3 m', '3 meter', '3 metres', '3 metri', '3 metry'])
  );
}

function hasOnePointFiveMeterHint(rawText: string, normalizedText: string): boolean {
  return (
    /(^|[^a-z0-9])1[.,\s]?5\s*(?:m|м|meter|metre|метр(?:и|ів)?)\b/.test(rawText) ||
    /\b1\s*5m\b/.test(rawText) ||
    containsAny(normalizedText, ['1 5 m', '1 5 meter', '1 5 metres', '1 5 metri', '1 5 metry'])
  );
}

export function resolveRuleBasedMatch(rawTitle: string, normalizedTitle: string): BestVariantMatch | null {
  const has = (...terms: string[]) =>
    terms.some((term) => normalizedTitle.includes(normalizeForMatch(term)));

  if (has('термопаста', 'termopasta', 'thermal', 'paste')) {
    return { variant: 'Термопаста, 2 гр.', confidence: 0.99 };
  }

  if (has('hdmi') && has('rca', 'tulpan', 'av', 'composite', 'kompozit')) {
    return { variant: 'Перехідник HDMI-RCA', confidence: 0.98 };
  }

  if (has('hdmi') && has('vga', 'monitor', 'display')) {
    return { variant: 'Перехідник HDMI-VGA', confidence: 0.98 };
  }

  if (has('hdmi') && has('displayport', 'display port', 'dp')) {
    return { variant: 'Перехідник HDMI-DP', confidence: 0.98 };
  }

  if (has('scart', 'skart')) {
    if (has('кабель', 'kabel', 'cable', 'lead')) {
      return { variant: 'Кабель SCART', confidence: 0.95 };
    }

    return { variant: 'Перехідник SCART', confidence: 0.95 };
  }

  if (has('usb') && has('type c', 'type-c', 'usb c', 'usb-c')) {
    return { variant: 'Кабель USB Type C', confidence: 0.98 };
  }

  if (has('usb') && has('console', 'consol', 'debug', 'налагодження', 'консоль')) {
    return { variant: 'Кабель USB консольний', confidence: 0.98 };
  }

  if (has('usb') && has('rs232', 'rs 232', 'serial', 'com', 'послідовний')) {
    if (hasThreeMeterHint(rawTitle, normalizedTitle)) {
      return { variant: 'Кабель USB-RS232 3 метри', confidence: 0.97 };
    }

    if (hasOnePointFiveMeterHint(rawTitle, normalizedTitle)) {
      return { variant: 'Кабель USB-RS232, 1.5 м', confidence: 0.97 };
    }

    if (has('кабель', 'kabel', 'cable', 'lead')) {
      return { variant: 'Кабель USB-RS232, 1.5 м', confidence: 0.9 };
    }

    return { variant: 'Перехідник USB-RS232', confidence: 0.9 };
  }

  return null;
}

