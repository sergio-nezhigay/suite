import { RouteHandler } from 'gadget-server';
import { google } from 'googleapis';
import type { sheets_v4 } from 'googleapis';

async function authorize(config: any) {
  const key = (config.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  return new google.auth.JWT(
    config.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    undefined,
    key,
    ['https://www.googleapis.com/auth/spreadsheets']
  );
}

const range = 'Sheet2!A1';

interface RequestBody {
  rows: any[][];
  spreadsheetId: string;
}

const route: RouteHandler<{
  Body: RequestBody;
}> = async ({ reply, request, logger, config }) => {
  const { rows, spreadsheetId } = request.body;

  if (!rows || !Array.isArray(rows) || rows.length === 0 || !spreadsheetId) {
    return reply
      .code(400)
      .send({ error: 'Rows and spreadsheetId are required' });
  }

  logger.info({ rows }, 'Received rows for Google Sheets append');

  try {
    const auth = await authorize(config);
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: rows },
    });

    const responseData: sheets_v4.Schema$AppendValuesResponse = response.data;

    logger.info({ responseData }, 'Rows appended successfully to Google Sheets');

    await reply.send({ 
      success: true, 
      addedRows: rows.length,
      updates: responseData.updates 
    });
  } catch (error) {
    logger.error({ error }, 'Error appending rows to Google Sheets');
    // Don't expose the actual error details in the response
    return reply
      .code(500)
      .send({ error: 'An error occurred while processing your request' });
  }
};

export default route;