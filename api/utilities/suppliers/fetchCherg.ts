import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
//import { FetchingFunc } from 'api/types';
import { getPaginatedData } from '../getPaginatedData';
import { FetchingFunc } from '../../types';

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
  Цена: string;
  Остаток: string;
  'EBJ81UG8BBU0-GN-F': string;
};

export async function fetchCherg({ query, limit, page }: FetchingFunc) {
  await doc.loadInfo();
  const sheet = doc.sheetsById[35957627];

  const rows = await sheet.getRows<ProductsRowData>();

  const mappedRows = rows.map((row) => {
    return {
      name: `${row.get('EBJ81UG8BBU0-GN-F')} ${row.get('Параметры')} ${row.get(
        'Модель'
      )}`,
      part_number: (row.get('Модель') || '').toLowerCase(),
      price: row.get('Цена'),
      instock: row.get('Остаток'),
      id: row.get('Модель'),
      warranty: 36,
    };
  });

  const words = query
    .toLowerCase()
    .split(' ')
    .filter((word) => word);

  const products = mappedRows.filter(
    ({ instock, part_number, name }) =>
      words.every((word) => name.includes(word)) && instock && part_number
  );
  console.log('🚀 ~ products:', products);

  return {
    products: getPaginatedData(products, Number(limit), Number(page)),
    count: products.length,
  };
}
