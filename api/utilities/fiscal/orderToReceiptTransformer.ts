import { CheckboxReceiptBody, CheckboxGood, CheckboxSellReceiptBody } from './checkboxTypes';
import { assignReceiptNames } from './receiptNames';

type OrderLineData = {
  title: string;
  price: string;
  quantity?: number;
};

type OrderData = {
  orderId?: string;
  id?: string;
  lineItems?: OrderLineData[];
};

export class OrderToReceiptTransformer {
  // Names are computed here (not taken from the frontend) so every check flow uses the same rules
  private static buildGoods(orderData: OrderData): CheckboxGood[] {
    const lineItems = orderData.lineItems || [];
    const names = assignReceiptNames(lineItems, orderData.orderId || orderData.id || '');

    return lineItems.map((item, index) => ({
      good: {
        code: String(index + 1).padStart(4, '0'), // "0001", "0002", etc.
        name: names[index],
        price: Math.round(parseFloat(item.price) * 100),
      },
      quantity: (item.quantity || 1) * 1000, // Checkbox format: 1000 = 1 item
      is_return: false,
      discounts: [],
    }));
  }

  private static total(goods: CheckboxGood[]): number {
    return goods.reduce((sum, good) => sum + (good.good.price * good.quantity / 1000), 0);
  }

  static transformOrderFromData(orderData: OrderData, order: any, ettnNumber: string): CheckboxReceiptBody {
    const goods = this.buildGoods(orderData);
    return {
      goods,
      payments: [{
        type: "ETTN",
        value: this.total(goods),
        ettn: ettnNumber
      }],
      discounts: [],
      deliveries: []
    };
  }

  static transformOrderFromDataForSell(orderData: OrderData, order: any): CheckboxSellReceiptBody {
    const goods = this.buildGoods(orderData);
    return {
      goods,
      payments: [{
        type: "CASHLESS",
        value: this.total(goods)
      }]
    };
  }
}
