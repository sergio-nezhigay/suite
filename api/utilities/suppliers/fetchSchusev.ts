import { parse } from 'csv-parse/sync';
import iconv from 'iconv-lite';
import { getPaginatedData } from './getPaginatedData';
import { FetchingFunc } from '../types';
const SCHUSEV_PRICE_URL = process.env.SCHUSEV_PRICE_URL || '';

export async function fetchSchusev({ query, limit, page }: FetchingFunc) {
  try {
    const response = await fetch(SCHUSEV_PRICE_URL);

    const buffer = await response.arrayBuffer();
    const decodedText = iconv.decode(Buffer.from(buffer), 'win1251');

    const records = parse(decodedText, {
      delimiter: '\t',
      skip_empty_lines: true,
      relax_column_count: true,
    });

    const filteredData = records
      .filter((record: string | any[]) => record.length >= 5 && record[4] > 0) // Ensure minimum fields and stock > 0
      .map((element: any[], index: any) => ({
        name: element[1],
        part_number: element[0]?.toLowerCase(),
        price: element[2],
        instock: element[4],
        warranty: '12',
        id: element[0] + index,
      }));

    const queryLower = query?.toLowerCase() || '';
    const queriedData = query
      ? filteredData.filter(
          (item: { name: string; part_number: string }) =>
            item.name.toLowerCase().includes(queryLower) ||
            item.part_number.toLowerCase().includes(queryLower)
        )
      : filteredData;

    return {
      products: getPaginatedData(queriedData, Number(limit), Number(page)),
      count: queriedData.length,
    };
  } catch (err) {
    console.error('Error in fetching or parsing the CSV:', err);
    throw err;
  }
}
