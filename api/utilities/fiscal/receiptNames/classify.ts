import type { ReceiptCategory, ReceiptForm } from './catalog';

export type Classification = {
  category: ReceiptCategory | null;
  form: ReceiptForm | null;
};

const CABLE_WORDS = /кабель|шнур|подовжувач|cable/;
const ADAPTER_WORDS = /адаптер|перехідник|конвертер|перетворювач|сплітер|розгалужувач|хаб|карта|adapter|converter|splitter|hub/;
const DC_PLUG = /\bdc\b|\d[.,]\d\s*[x×х*]\s*\d/;

function detectCategory(t: string): ReceiptCategory | null {
  if (/rs-?232|rs-?485|\bcom\b|com[- ]?port|db-?9|uart|\bttl\b|консольн|послідовн|serial/.test(t)) return 'usb-com';
  const hdmi = t.includes('hdmi');
  const vga = /vga|d-sub/.test(t);
  if (hdmi && vga) return 'hdmi-vga';
  if (vga) return 'vga';
  const typeC = /type-?c|usb-?c\b/.test(t);
  if (typeC && DC_PLUG.test(t)) return 'usbc-dc';
  if (/\bc13\b|\biec\b|220\s*(в|v)|мережевий кабель/.test(t)) return 'power';
  if (t.includes('usb') && (typeC || /micro|lightning/.test(t)) && CABLE_WORDS.test(t) && !DC_PLUG.test(t)) return 'usb-data';
  return null;
}

// Whichever of cable/adapter words comes first in the title wins
function detectForm(t: string): ReceiptForm | null {
  const cable = t.search(CABLE_WORDS);
  const adapter = t.search(ADAPTER_WORDS);
  if (cable === -1 && adapter === -1) return null;
  if (adapter === -1) return 'cable';
  if (cable === -1) return 'adapter';
  return cable < adapter ? 'cable' : 'adapter';
}

export function classifyTitle(title: string): Classification {
  const t = title.toLowerCase();
  return { category: detectCategory(t), form: detectForm(t) };
}
