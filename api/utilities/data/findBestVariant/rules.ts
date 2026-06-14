import { normalizeForMatch } from './normalize';
import type { BestVariantMatch } from './types';

function containsAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(normalizeForMatch(term)));
}

export function resolveRuleBasedMatch(rawTitle: string, normalizedTitle: string): BestVariantMatch | null {
  const has = (...terms: string[]) =>
    terms.some((term) => normalizedTitle.includes(normalizeForMatch(term)));

  if (has('rs232', 'rs-232', 'serial', '232', 'rs485', 'rs-485', '485', 'ttl', 'com port', 'uart', 'db9', 'послідовний')) {
    return { variant: 'Кабель USB to Com (USB to RS232) (17303)', confidence: 0.97 };
  }

  if (has('живлення', 'c13', 'iec 320', 'mains', 'power')) {
    return { variant: 'Кабель живлення C13 1.8m, Maxxter (CL-22-6)', confidence: 0.99 };
  }

  if (has('type', 'usb-c')) {
    return { variant: 'Адаптер USB-C F to DC M Voltronic', confidence: 0.99 };
  }

  if (has('hdmi')) {
    return { variant: 'Перехідник ST-Lab HDMI male (PC/laptop)- VGA F(Monitor) (U-991 black)', confidence: 0.98 };
  }

  if (has('vga', 'd-sub 15', 'hd15', 'кабель vga', 'vga cable', 'vga lead', 'atcom')) {
    return { variant: 'Кабель VGA 1.8m Atcom (15261)', confidence: 0.95 };
  }

  if (has('usb')) {
    return { variant: 'Дата кабель USB 2.0 AM to Type-C 1.5m US288', confidence: 0.90 };
  }

  return null;
}
