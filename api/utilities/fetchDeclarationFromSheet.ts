import { google } from 'googleapis';
import { authorize } from './suppliers/authorizeGoogle';

interface DeclarationConfig {
  spreadsheetId: string;
  sheetName?: string;
  startRow?: number;
  orderNameColumn?: number;
  declarationColumn?: number;
}

/**
 * Generic function to fetch declarations from Google Sheets
 * Extracted from fetchNovaPoshtaDeclaration for reuse
 */
export async function fetchDeclarationFromSheet(
  orderName: string,
  config: any,
  declarationConfig: DeclarationConfig
): Promise<string | null> {
  const {
    spreadsheetId,
    sheetName = 'Баланс',
    startRow = 9500,
    orderNameColumn = 4,
    declarationColumn = 14,
  } = declarationConfig;

  try {
    console.time(`[${orderName}] Step 1: Authorize & get sheets client`);
    const auth = await authorize(config);
    const sheets = google.sheets({ version: 'v4', auth });
    console.timeEnd(`[${orderName}] Step 1: Authorize & get sheets client`);

    const range = `${sheetName}!A${startRow}:Z`;

    console.time(`[${orderName}] Step 2: Fetch & process spreadsheet data`);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    const data = response.data.values;

    if (!data?.length) {
      console.timeEnd(
        `[${orderName}] Step 2: Fetch & process spreadsheet data`
      );
      return null;
    }

    const matchingRow = data.find(
      (row) => row?.[orderNameColumn] === orderName
    );

    if (!matchingRow) {
      console.timeEnd(
        `[${orderName}] Step 2: Fetch & process spreadsheet data`
      );
      return null;
    }

    console.timeEnd(`[${orderName}] Step 2: Fetch & process spreadsheet data`);
    const rawValue = matchingRow[declarationColumn];
    if (!rawValue) {
      return null;
    }

    return String(rawValue).trim();
  } catch (error) {
    console.error(`[${orderName}] Error in fetchDeclarationFromSheet:`, error);
    return null;
  }
}

// Convenience functions for specific suppliers
export async function fetchNovaPoshtaDeclaration(
  orderName: string,
  config: any
): Promise<string | null> {
  return fetchDeclarationFromSheet(orderName, config, {
    spreadsheetId: '1IE-6iZ0tgTPdg0RzWhdzRMv0tca9x5Th8BIg5P0gjwE',
    sheetName: '2026',
    startRow: 2,
    orderNameColumn: 4,
    declarationColumn: 24,
  });
}


