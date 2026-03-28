import { resolveBestVariant } from '../data/findBestVariant';
import { CheckboxReceiptBody, CheckboxGood, CheckboxSellReceiptBody } from './checkboxTypes';

export class OrderToReceiptTransformer {
  static transformOrder(order: any, ettnNumber: string): CheckboxReceiptBody {
    const lineItems = order.lineItems || [];
    const goods: CheckboxGood[] = lineItems.map((item: any, index: number) => {
      // Handle different possible price structures
      let unitPriceUAH = 0;
      if (item.priceSet?.shopMoney?.amount) {
        unitPriceUAH = parseFloat(item.priceSet.shopMoney.amount);
      } else if (item.price) {
        unitPriceUAH = parseFloat(item.price);
      }

      const priceKopecks = Math.round(unitPriceUAH * 100);

      return {
        good: {
          code: String(index + 1).padStart(4, '0'), // "0001", "0002", etc.
          name: this.mapProductVariant(item.title || item.name || 'Unknown Product'),
          price: priceKopecks
        },
        quantity: (item.quantity || 1) * 1000, // Checkbox format: 1000 = 1 item
        is_return: false,
        discounts: []
      };
    });

    const totalAmount = goods.reduce((sum, good) =>
      sum + (good.good.price * good.quantity / 1000), 0
    );

    console.log(`Transforming order ${order.name}: ${goods.length} items, total: ${totalAmount} kopecks`);

    return {
      goods,
      payments: [{
        type: "ETTN",
        value: totalAmount,
        ettn: ettnNumber
      }],
      discounts: [],
      deliveries: []
    };
  }

  static transformOrderFromData(orderData: any, order: any, ettnNumber: string): CheckboxReceiptBody {
    const lineItems = orderData.lineItems || [];
    const goods: CheckboxGood[] = lineItems.map((item: any, index: number) => {
      const priceKopecks = Math.round(parseFloat(item.price) * 100);

      return {
        good: {
          code: String(index + 1).padStart(4, '0'), // "0001", "0002", etc.
          name: item.variant, // Use pre-calculated variant from frontend
          price: priceKopecks
        },
        quantity: (item.quantity || 1) * 1000, // Checkbox format: 1000 = 1 item
        is_return: false,
        discounts: []
      };
    });

    const totalAmount = goods.reduce((sum, good) =>
      sum + (good.good.price * good.quantity / 1000), 0
    );

    console.log(`Transforming order ${order.name}: ${goods.length} items, total: ${totalAmount} kopecks`);

    return {
      goods,
      payments: [{
        type: "ETTN",
        value: totalAmount,
        ettn: ettnNumber
      }],
      discounts: [],
      deliveries: []
    };
  }

  private static mapProductVariant(productTitle: string): string {
    const bestMatch = resolveBestVariant(productTitle).variant;
    console.log(`Mapped "${productTitle}" to "${bestMatch}"`);
    return bestMatch;
  }

  static transformOrderForSell(order: any): CheckboxSellReceiptBody {
    const lineItems = order.lineItems || [];
    const goods: CheckboxGood[] = lineItems.map((item: any, index: number) => {
      // Handle different possible price structures
      let unitPriceUAH = 0;
      if (item.priceSet?.shopMoney?.amount) {
        unitPriceUAH = parseFloat(item.priceSet.shopMoney.amount);
      } else if (item.price) {
        unitPriceUAH = parseFloat(item.price);
      }

      const priceKopecks = Math.round(unitPriceUAH * 100);

      return {
        good: {
          code: String(index + 1).padStart(4, '0'), // "0001", "0002", etc.
          name: this.mapProductVariant(item.title || item.name || 'Unknown Product'),
          price: priceKopecks
        },
        quantity: (item.quantity || 1) * 1000, // Checkbox format: 1000 = 1 item
        is_return: false,
        discounts: []
      };
    });

    const totalAmount = goods.reduce((sum, good) =>
      sum + (good.good.price * good.quantity / 1000), 0
    );

    console.log(`Transforming order ${order.name} for sell receipt: ${goods.length} items, total: ${totalAmount} kopecks`);

    return {
      goods,
      payments: [{
        type: "CASHLESS",
        value: totalAmount
      }]
    };
  }

  static transformOrderFromDataForSell(orderData: any, order: any): CheckboxSellReceiptBody {
    const lineItems = orderData.lineItems || [];
    const goods: CheckboxGood[] = lineItems.map((item: any, index: number) => {
      const priceKopecks = Math.round(parseFloat(item.price) * 100);

      return {
        good: {
          code: String(index + 1).padStart(4, '0'), // "0001", "0002", etc.
          name: item.variant, // Use pre-calculated variant from frontend
          price: priceKopecks
        },
        quantity: (item.quantity || 1) * 1000, // Checkbox format: 1000 = 1 item
        is_return: false,
        discounts: []
      };
    });

    const totalAmount = goods.reduce((sum, good) =>
      sum + (good.good.price * good.quantity / 1000), 0
    );

    console.log(`Transforming order ${order.name} for sell receipt: ${goods.length} items, total: ${totalAmount} kopecks`);

    return {
      goods,
      payments: [{
        type: "CASHLESS",
        value: totalAmount
      }]
    };
  }
}
