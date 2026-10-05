export type ReceiptCategory = 'usb-com' | 'hdmi-vga' | 'vga' | 'power' | 'usb-data' | 'usbc-dc';
export type ReceiptForm = 'cable' | 'adapter';
export type ReceiptTier = 'branded' | 'generic';

export type CatalogEntry = {
  name: string;
  category: ReceiptCategory;
  form: ReceiptForm;
  tier: ReceiptTier;
  // Names sharing an article are the same item: never print two of them in one check
  article: string;
};

// Unit prices at or above this get branded names
export const BRANDED_PRICE_UAH = 800;

export const RECEIPT_CATALOG: CatalogEntry[] = [
  { name: 'Кабель USB to COM 1.0m PATRON(CAB-PN-USB-COM)', category: 'usb-com', form: 'cable', tier: 'branded', article: 'CAB-PN-USB-COM' },
  { name: 'Кабель USB to COM 70172', category: 'usb-com', form: 'cable', tier: 'generic', article: '70172' },
  { name: 'Кабель USB to Com (USB to RS232) (17303)', category: 'usb-com', form: 'cable', tier: 'generic', article: '17303' },
  { name: 'Перехідник PowerPlant USB to COM(KD00AS1286)', category: 'usb-com', form: 'adapter', tier: 'branded', article: 'KD00AS1286' },
  { name: 'Перехідник USB to COM 1.5m Cablexpert(UAS-DB9M-02)', category: 'usb-com', form: 'adapter', tier: 'branded', article: 'UAS-DB9M-02' },
  { name: 'Адаптер Dynamode USB to COM 1.5m (FTDI-DB9M-02)', category: 'usb-com', form: 'adapter', tier: 'branded', article: 'FTDI-DB9M-02' },
  { name: 'Адаптер USB to RS232 (DA-70156) USB 2.0', category: 'usb-com', form: 'adapter', tier: 'branded', article: 'DA-70156' },
  { name: 'Перехідник USB to Com (USB to RS232) (17303)', category: 'usb-com', form: 'adapter', tier: 'generic', article: '17303' },
  { name: 'Перехідник USB to Com (17303)', category: 'usb-com', form: 'adapter', tier: 'generic', article: '17303' },
  { name: 'Адаптер USB to COM 70172', category: 'usb-com', form: 'adapter', tier: 'generic', article: '70172' },
  { name: 'Адаптер USB to Com (USB to RS232) (17303)', category: 'usb-com', form: 'adapter', tier: 'generic', article: '17303' },
  { name: 'Перехідник ST-Lab HDMI male (PC/laptop)- VGA F(Monitor) (U-991 black)', category: 'hdmi-vga', form: 'adapter', tier: 'generic', article: 'U-991' },
  { name: 'Перехідник HDMI M to VGA F (w/o cables) ST-Lab (U-990 Pro BTC)', category: 'hdmi-vga', form: 'adapter', tier: 'generic', article: 'U-990' },
  { name: 'Перехідник ST-Lab HDMI male - VGA F (U-990 Pro BTC white)', category: 'hdmi-vga', form: 'adapter', tier: 'generic', article: 'U-990' },
  { name: 'Кабель живлення C13 1.8m, Maxxter (CL-22-6)', category: 'power', form: 'cable', tier: 'generic', article: 'CL-22-6' },
  { name: 'Кабель VGA 1.8m Atcom (15261)', category: 'vga', form: 'cable', tier: 'generic', article: '15261' },
  { name: 'Дата кабель USB 2.0 AM to Type-C 1.5m US288', category: 'usb-data', form: 'cable', tier: 'generic', article: 'US288' },
  { name: 'Адаптер USB-C F to DC M Voltronic', category: 'usbc-dc', form: 'adapter', tier: 'generic', article: 'Voltronic' },
];
