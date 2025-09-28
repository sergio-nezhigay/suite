export interface CheckboxAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface CheckboxShift {
  id: string;
  status: string;
  opened_at: string;
}

export interface CheckboxGood {
  good: {
    code: string;
    name: string;
    price: number; // kopecks
  };
  quantity: number; // 1000 = 1 item
  is_return: boolean;
  discounts: any[];
}

export interface CheckboxETTNPayment {
  type: "ETTN";
  value: number; // kopecks
  ettn: string; // Nova Poshta TTN
}

export interface CheckboxCashlessPayment {
  type: "CASHLESS";
  value: number; // kopecks
}

export interface CheckboxCashPayment {
  type: "CASH";
  value: number; // kopecks
}

export type CheckboxPayment = CheckboxETTNPayment | CheckboxCashlessPayment | CheckboxCashPayment;

export interface CheckboxReceiptBody {
  goods: CheckboxGood[];
  payments: CheckboxPayment[];
  discounts: any[];
  deliveries: any[];
}

export interface CheckboxSellReceiptBody {
  goods: CheckboxGood[];
  payments: (CheckboxCashlessPayment | CheckboxCashPayment)[];
  discounts?: any[];
}

export interface CheckboxReceiptResponse {
  id: string;
  status?: string; // Should be "CREATED" for successful receipts
  fiscal_code?: string;
  fiscal_date?: string;
  receipt_url?: string;
}