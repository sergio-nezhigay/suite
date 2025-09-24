import { google } from 'googleapis';

import { authorize } from '../authorizeGoogle';

const SPREADSHEET_ID = '1IE-6iZ0tgTPdg0RzWhdzRMv0tca9x5Th8BIg5P0gjwE';
export async function fetchNovaPoshtaDeclaration(
  orderName: string,
  config: any
): Promise<string | null> {
  try {
    console.time(`[${orderName}] Step 1: Authorize & get sheets client`);
    const auth = await authorize(config);
    const sheets = google.sheets({ version: 'v4', auth });
    console.timeEnd(`[${orderName}] Step 1: Authorize & get sheets client`);

    const startRow = 7100;
    const range = `Аркуш1!A${startRow}:O`;

    console.time(`[${orderName}] Step 2: Fetch & process spreadsheet data`);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });
    const data = response.data.values;
    if (!data?.length) {
      console.log('No data found in the specified range.');
      console.timeEnd(
        `[${orderName}] Step 2: Fetch & process spreadsheet data`
      );
      return null;
    }
    const matchingRow = data.find((row) => row?.[4] === orderName);
    if (!matchingRow) {
      console.log(`orderName ${orderName} not found in rows ${startRow}+.`);
      console.timeEnd(
        `[${orderName}] Step 2: Fetch & process spreadsheet data`
      );
      return null;
    }
    console.timeEnd(`[${orderName}] Step 2: Fetch & process spreadsheet data`);
    return matchingRow[14] ?? null;
  } catch (error) {
    console.error(`[${orderName}] Error in fetchNovaPoshtaDeclaration:`, error);
    return null;
  }
}
