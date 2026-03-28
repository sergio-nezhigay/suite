import { normalizeForMatch } from './normalize';
import type { VariantProfile } from './types';

export const DEFAULT_VARIANT = 'Кабель USB консольний';
export const LOW_CONFIDENCE_THRESHOLD = 0.35;

export const VARIANT_PROFILES: VariantProfile[] = [
  {
    title: 'Кабель USB консольний',
    aliases: ['usb console cable', 'console cable', 'usb console', 'console lead'],
    keywords: ['usb', 'console', 'consol', 'debug', 'налагодження', 'консоль'],
  },
  {
    title: 'Перехідник HDMI-RCA',
    aliases: ['hdmi rca', 'hdmi to rca', 'av converter', 'composite converter', 'tulpan'],
    keywords: ['hdmi', 'rca', 'av', 'composite', 'тюльпан', 'композит'],
  },
  {
    title: 'Кабель SCART',
    aliases: ['scart cable', 'кабель scart', 'scart lead'],
    keywords: ['scart', 'скарт', 'кабель'],
  },
  {
    title: 'Перехідник SCART',
    aliases: ['scart adapter', 'перехідник scart', 'scart converter'],
    keywords: ['scart', 'скарт', 'adapter', 'перехідник'],
  },
  {
    title: 'Перехідник USB-RS232',
    aliases: ['usb rs232 adapter', 'usb to rs232', 'serial adapter', 'com port adapter'],
    keywords: ['usb', 'rs232', 'rs 232', 'serial', 'com', 'послідовний'],
  },
  {
    title: 'Кабель USB-RS232, 1.5 м',
    aliases: ['usb rs232 1.5 m', 'usb rs232 1.5m', 'rs232 cable 1.5 m', 'rs232 cable 1.5m'],
    keywords: ['usb', 'rs232', 'rs 232', 'cable', 'кабель'],
  },
  {
    title: 'Кабель USB-RS232 3 метри',
    aliases: ['usb rs232 3 m', 'usb rs232 3m', 'rs232 cable 3 m', 'rs232 cable 3m', '3 meter cable'],
    keywords: ['usb', 'rs232', 'rs 232', 'cable', 'кабель', '3m', '3 m', '3 метри'],
  },
  {
    title: 'Перехідник HDMI-DP',
    aliases: ['hdmi dp', 'hdmi displayport', 'displayport adapter', 'dp converter'],
    keywords: ['hdmi', 'dp', 'displayport', 'display port'],
  },
  {
    title: 'Кабель USB Type C',
    aliases: ['usb type c', 'usb c cable', 'type c cable', 'usb-c cable'],
    keywords: ['usb', 'type c', 'type-c', 'usb-c', 'cable', 'кабель'],
  },
  {
    title: 'Перехідник HDMI-VGA',
    aliases: ['hdmi vga', 'hdmi to vga', 'vga adapter', 'vga converter'],
    keywords: ['hdmi', 'vga', 'монітор', 'дисплей', 'display'],
  },
  {
    title: 'Термопаста, 2 гр.',
    aliases: ['thermal paste', 'thermal compound', 'cpu paste', 'термопаста'],
    keywords: ['термопаста', 'thermal', 'paste', 'compound', 'cpu'],
  },
];

export type NormalizedVariantProfile = VariantProfile & {
  normalizedTitle: string;
  normalizedAliases: string[];
  normalizedKeywords: string[];
};

export const NORMALIZED_VARIANT_PROFILES: NormalizedVariantProfile[] = VARIANT_PROFILES.map((profile) => ({
  ...profile,
  normalizedTitle: normalizeForMatch(profile.title),
  normalizedAliases: profile.aliases.map((alias) => normalizeForMatch(alias)),
  normalizedKeywords: profile.keywords.map((keyword) => normalizeForMatch(keyword)),
}));

