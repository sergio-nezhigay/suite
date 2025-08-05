import { google } from 'googleapis';

export async function authorize(config: any) {
  const key = (config.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  return new google.auth.JWT(
    config.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    undefined,
    key,
    ['https://www.googleapis.com/auth/spreadsheets']
  );
}
