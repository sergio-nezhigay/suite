import { authorize } from 'api/utilities/suppliers/authorizeGoogle';
import { RouteHandler } from 'gadget-server';
import { google } from 'googleapis';
import type { sheets_v4 } from 'googleapis';

//async function authorize(config: any) {
//  const key = (config.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
//  return new google.auth.JWT(
//    config.GOOGLE_SERVICE_ACCOUNT_EMAIL,
//    undefined,
//    key,
//    ['https://www.googleapis.com/auth/spreadsheets']
//  );
//}

interface RequestBody {
  rows: any[][];
  spreadsheetId: string;
  sheetName?: string;
}

const route: RouteHandler<{
  Body: RequestBody;
}> = async ({ reply, request, config, logger }) => {
  const { rows, spreadsheetId, sheetName = 'Sheet2' } = request.body;

  if (!rows || !Array.isArray(rows) || rows.length === 0 || !spreadsheetId) {
    return reply
      .code(400)
      .send({ error: 'Rows and spreadsheetId are required' });
  }

  const range = `${sheetName}!A1`;
  const startedAt = Date.now();
  try {
    const auth = await authorize(config);
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: rows },
    },
    // Below the extension's 30s timeout, so the caller gets a clear 500 instead of hanging
    { timeout: 20000 });
    logger.info(
      { spreadsheetId, rows: rows.length, ms: Date.now() - startedAt },
      'Appended rows to Google Sheets'
    );

    const responseData: sheets_v4.Schema$AppendValuesResponse = response.data;
    await reply.send({
      success: true,
      addedRows: rows.length,
      updates: responseData.updates,
    });
  } catch (error) {
    logger.error(
      { err: error, spreadsheetId, ms: Date.now() - startedAt },
      'Error appending rows to Google Sheets'
    );
    // Don't expose the actual error details in the response
    return reply
      .code(500)
      .send({ error: 'An error occurred while processing your request' });
  }
};

export default route;
