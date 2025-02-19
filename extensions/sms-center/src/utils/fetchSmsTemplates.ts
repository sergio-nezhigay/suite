import { gadgetApi } from './gadgetApi';

type Templates = {
  id: string;
  smsText: string;
  title: string;
}[];

export const fetchSmsTemplates = async (): Promise<Templates> => {
  try {
    const result: Templates = await gadgetApi.smsTemplates.findMany();
    return result;
  } catch (err) {
    console.error('Failed to fetch smsTemplates:', JSON.stringify(err));
    throw new Error(`Failed to fetch smsTemplates: ${JSON.stringify(err)}`);
  }
};
