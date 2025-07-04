import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

import { FetchingFunc } from 'types/index';
import { getPaginatedData } from 'utilities';

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

type ProductsRowData = {
  Параметры: string;
  Модель: string;
  Цена: string;
  Остаток: string;
  'EBJ81UG8BBU0-GN-F': string;
};

export async function fetchFromSheet({
  query,
  limit,
  page,
  sheetId,
  tabId,
}: FetchingFunc & { sheetId: string; tabId: number }) {
  try {
    const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
    await doc.loadInfo();
    const sheet = doc.sheetsById[tabId];

    const rows = await sheet.getRows<ProductsRowData>();

    const mappedRows = rows.map((row) => ({
      name: `${row.get('EBJ81UG8BBU0-GN-F')} ${row.get('Параметры')} ${row.get(
        'Модель'
      )}`,
      part_number: (row.get('Модель') || '').toLowerCase(),
      price: row.get('Цена'),
      instock: row.get('Остаток'),
      id: row.get('Модель'),
      warranty: 36,
    }));

    const words = query.toLowerCase().split(' ').filter(Boolean);

    const products = mappedRows.filter(
      ({ instock, part_number, name }) =>
        words.every((word) => name.includes(word)) && instock && part_number
    );

    return {
      products: getPaginatedData(products, Number(limit), Number(page)),
      count: products.length,
    };
  } catch (error) {
    console.error('Error fetching from sheet:', error);
    throw error;
  }
}
