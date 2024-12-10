export type ProductOptions = {
  [key: string]: {
    name: string;
    valueNames: string[];
  };
};

export interface Product {
  title: string;
  vendor: string;
  description: string;
  pictures: string[];
  price: string;
  part_number: string;
  options?: ProductOptions;
}
export type Products = Product[];

export interface FetchingFunc {
  query: string;
  limit: string;
  page: string;
  categoryId?: string;
}

export interface BrainFetch {
  category: string;
  query: string;
  limit: string;
  page: string;
  sid?: string;
}

export interface RequestParams {
  url: string;
  params?: Record<string, any>;
  method?: 'GET' | 'POST';
  postData?: Record<string, any>;
}
