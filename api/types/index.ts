export interface Product {
  title: string;
  vendor: string;
  description: string;
  pictures: string[];
  price: string;
  part_number: string;
}
export type Products = Product[];

export interface FetchingFunc {
  query: string;
  limit: number;
  page: number;
}
