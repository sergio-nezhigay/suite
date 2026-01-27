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

    const range = `${sheetName}!A${startRow}:Z${startRow + 10000}`;

    console.time(`[${orderName}] Step 2: Fetch & process spreadsheet data`);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
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

    const matchingRow = data.find(
      (row) => row?.[orderNameColumn] === orderName
    );

    if (!matchingRow) {
      console.log(`orderName ${orderName} not found in rows ${startRow}+.`);
      console.timeEnd(
        `[${orderName}] Step 2: Fetch & process spreadsheet data`
      );
      return null;
    }

    console.timeEnd(`[${orderName}] Step 2: Fetch & process spreadsheet data`);
    return matchingRow[declarationColumn] ?? null;
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
    sheetName: 'Аркуш1',
    startRow: 7100,
    orderNameColumn: 4,
    declarationColumn: 14,
  });
}

export async function fetchEeasybuyDeclaration(
  orderName: string,
  config: any
): Promise<string | null> {
  // TODO: Replace with actual eeasybuy spreadsheet ID and configuration
  return fetchDeclarationFromSheet(orderName, config, {
    spreadsheetId: '1IE-6iZ0tgTPdg0RzWhdzRMv0tca9x5Th8BIg5P0gjwE', // Placeholder
    sheetName: 'Аркуш1',
    startRow: 7100,
    orderNameColumn: 4,
    declarationColumn: 14,
  });
}
