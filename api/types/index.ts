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

interface Name {
  first_name: string;
  last_name: string;
}

interface City {
  title?: string;
}

interface Delivery {
  place_number?: string;
  city?: City;
}

interface Purchase {
  item: { price_offer_id: string };
  item_name: string;
  quantity: string;
  price_with_discount?: string;
  price: string;
}

export interface RozetkaOrder {
  id: number;
  recipient_phone: string;
  recipient_title: Name;
  delivery?: Delivery;
  purchases?: Purchase[];
  amount_with_discount?: string;
  amount: string;
}

interface ShopifyMoney {
  amount: string | number;
  currencyCode: string;
}

interface ShippingAddress {
  address1: string;
  firstName: string;
  lastName: string;
  city: string;
  zip: string;
  countryCode: string;
  phone: string;
}

interface Transaction {
  gateway: string;
  amountSet: { shopMoney: ShopifyMoney };
  kind: string;
  status: string;
}

interface LineItem {
  title: string;
  quantity: number | string;
  priceSet: { shopMoney: ShopifyMoney };
  properties: Array<{ name: string; value: string | number }>;
}

export interface ShopifyOrder {
  name: string;
  email: string;
  shippingAddress: ShippingAddress;
  transactions: Transaction[];
  lineItems: LineItem[];
}
