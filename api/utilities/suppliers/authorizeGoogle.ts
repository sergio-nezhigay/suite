// googleapis is huge (seconds of CPU to load). Load it only when a Google call
// actually runs, so every cold start of the server doesn't pay for it.
async function loadGoogle() {
  const { google } = await import('googleapis');
  return google;
}

export async function authorize(config: any) {
  const google = await loadGoogle();
  const key = (config.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  return new google.auth.JWT(
    config.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    undefined,
    key,
    ['https://www.googleapis.com/auth/spreadsheets']
  );
}

export async function getSheetsClient(config: any) {
  const google = await loadGoogle();
  const auth = await authorize(config);
  return google.sheets({ version: 'v4', auth });
}
