import { gadgetApi } from './gadgetApi';

export const fetchSmsTemplates = async () => {
  try {
    const result = await gadgetApi.smsTemplates.findMany();
    return result;
  } catch (err) {
    console.error('Failed to fetch smsTemplates:', err);
    throw new Error('Failed to fetch smsTemplates');
  }
};
