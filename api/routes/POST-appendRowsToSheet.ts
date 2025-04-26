import { RouteHandler } from 'gadget-server';
import { google } from 'googleapis';

async function authorize() {
  const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  return new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    undefined,
    key,
    ['https://www.googleapis.com/auth/spreadsheets']
  );
}

const range = 'Sheet2!A1';

const route: RouteHandler<{
  Body: { rows: any[][]; spreadsheetId: string };
}> = async ({ reply, request }) => {
  const { rows, spreadsheetId } = request.body;
  if (!rows || !Array.isArray(rows) || rows.length === 0 || !spreadsheetId) {
    return reply
      .status(400)
      .send({ error: 'Rows and spreadsheetId are required' });
  }

  console.log('Received rows:', rows);

  try {
    const auth = await authorize();
    const sheets = google.sheets({ version: 'v4', auth });

    const res = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: rows },
    });

    console.log('Rows appended successfully:', res.data);
    await reply.send({ success: true, addedRows: rows.length });
  } catch (error) {
    console.error('Error appending rows to Google Sheets:', error);
    // Don't expose the actual error details in the response
    return reply
      .status(500)
      .send({ error: 'An error occurred while processing your request' });
  }
};

export default route;
