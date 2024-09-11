import { gadgetApi } from './gadgetApi';

type SMSTemplate = {
  id: string;
  title: string;
  smsText: string;
};

export const fetchSmsTemplates = async (): Promise<SMSTemplate[]> => {
  try {
    const result = await gadgetApi.smsTemplates.findMany();
    return result;
  } catch (err) {
    console.error('Failed to fetch smsTemplates:', err);
    throw new Error('Failed to fetch smsTemplates');
  }
};
