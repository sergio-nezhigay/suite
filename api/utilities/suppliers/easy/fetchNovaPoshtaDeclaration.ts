import { logger } from 'gadget-server';
import { google } from 'googleapis';

import { authorize } from '../authorizeGoogle';

const SPREADSHEET_ID = '1IE-6iZ0tgTPdg0RzWhdzRMv0tca9x5Th8BIg5P0gjwE';
export async function fetchNovaPoshtaDeclaration(
  orderName: string,
  config: any
): Promise<string | null> {
  try {
    const step1Start = Date.now();
    const auth = await authorize(config);
    const sheets = google.sheets({ version: 'v4', auth });
    logger.info({ orderName, duration_ms: Date.now() - step1Start }, 'Step 1: Authorize & get sheets client');

    const startRow = 7100;
    const range = `Аркуш1!A${startRow}:O`;

    const step2Start = Date.now();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });
    const data = response.data.values;
    if (!data?.length) {
      logger.info({ orderName, duration_ms: Date.now() - step2Start }, 'Step 2: Fetch & process spreadsheet data');
      return null;
    }
    const matchingRow = data.find((row) => row?.[4] === orderName);
    if (!matchingRow) {
      logger.info({ orderName, duration_ms: Date.now() - step2Start }, 'Step 2: Fetch & process spreadsheet data');
      return null;
    }
    logger.info({ orderName, duration_ms: Date.now() - step2Start }, 'Step 2: Fetch & process spreadsheet data');
    return matchingRow[14] ?? null;
  } catch (error) {
    logger.error({ orderName, err: error }, 'Error in fetchNovaPoshtaDeclaration');
    return null;
  }
}
