import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(
  process.env.CHERG_PRICE_ID || '',
  serviceAccountAuth
);

type ProductsRowData = {
  Параметры: string;
  Модель: string;
  Цена: number;
  Остаток: number;
  'EBJ81UG8BBU0-GN-F': string;
};

interface FetchingFunc {
  query: string;
  limit: number;
  page: number;
}

export default async function fetchCherg({ query, limit, page }: FetchingFunc) {
  await doc.loadInfo();
  const sheet = doc.sheetsById[35957627];
  const rows = await sheet.getRows<ProductsRowData>();

  const mappedRows = rows.map((row) => {
    return {
      name: `${row.get('EBJ81UG8BBU0-GN-F')} ${row.get('Параметры')} ${row.get(
        'Модель'
      )}`,
      part_number: row.get('Модель'),
      price: row.get('Цена'),
      instock: row.get('Остаток'),
      id: row.get('Модель'),
      warranty: 36,
    };
  });

  const filtered = mappedRows.filter(({ instock }) => instock);
  const paginatedOffers = filtered.slice((page - 1) * limit, page * limit);
  return { products: paginatedOffers, count: filtered.length };
}
