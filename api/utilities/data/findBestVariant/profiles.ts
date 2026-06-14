import { normalizeForMatch } from './normalize';
import type { VariantProfile } from './types';

export const DEFAULT_VARIANT = 'Кабель USB to Com (USB to RS232) (17303)';
export const LOW_CONFIDENCE_THRESHOLD = 0.35;

export const VARIANT_PROFILES: VariantProfile[] = [
  {
    title: 'Кабель USB to Com (USB to RS232) (17303)',
    aliases: ['usb rs232 cable', 'usb to rs232', 'usb com cable', 'usb serial cable', 'usb 485', 'usb ttl'],
    keywords: ['rs232', 'rs-232', 'serial', '232', 'rs485', 'rs-485', '485', 'ttl', 'com port', 'uart', 'db9', 'послідовний'],
  },
  {
    title: 'Адаптер USB-C F to DC M Voltronic',
    aliases: ['usb-c dc adapter', 'usbc dc', 'type-c dc adapter', 'usb c dc'],
    keywords: ['type', 'usb-c', 'usbc', 'dc', 'voltronic'],
  },
  {
    title: 'Кабель живлення C13 1.8m, Maxxter (CL-22-6)',
    aliases: ['power cable c13', 'iec c13 cable', 'mains cable', 'maxxter power', 'cl-22'],
    keywords: ['живлення', 'c13', 'iec 320', 'mains', 'power', 'maxxter'],
  },
  {
    title: 'Кабель VGA 1.8m Atcom (15261)',
    aliases: ['vga cable', 'кабель vga', 'vga lead', 'atcom vga', 'd-sub 15 cable', 'hd15 cable'],
    keywords: ['vga', 'd-sub 15', 'hd15', 'atcom'],
  },
  {
    title: 'Дата кабель USB 2.0 AM to Type-C 1.5m US288',
    aliases: ['usb data cable', 'usb 2.0 cable', 'am to type-c', 'us288'],
    keywords: ['usb', 'дата кабель', 'data cable', 'us288'],
  },
  {
    title: 'Перехідник ST-Lab HDMI male (PC/laptop)- VGA F(Monitor) (U-991 black)',
    aliases: ['hdmi vga adapter', 'hdmi to vga', 'st-lab hdmi vga', 'u-991', 'u-990'],
    keywords: ['hdmi', 'st-lab', 'stlab', 'u-991', 'u-990'],
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

