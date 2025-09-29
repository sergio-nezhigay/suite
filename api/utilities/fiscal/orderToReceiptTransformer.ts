import { CheckboxReceiptBody, CheckboxGood, CheckboxSellReceiptBody, CheckboxCashlessPayment } from './checkboxTypes';

export class OrderToReceiptTransformer {
  // Ukrainian product variants mapping (from your extension)
  private static productVariants = [
    'Кабель USB консольний',
    'Перехідник HDMI-RCA',
    'Кабель SCART',
    'Перехідник SCART',
    'Перехідник USB-RS232',
    'Кабель USB-RS232 1.5m',
    'Кабель USB-RS232 3 метри',
    'Перехідник HDMI-DP',
    'Кабель USB Type C',
    'Перехідник HDMI-VGA',
    'Термопаста, 2 гр.',
  ];

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
    const bestMatch = this.findBestVariant(productTitle);
    console.log(`Mapped "${productTitle}" to "${bestMatch}"`);
    return bestMatch;
  }

  // TODO: Update callers to pass AppConnections and use the new AI-based findBestVariant
  // For now, keeping the old logic as fallback for static usage
  private static findBestVariant(productTitle: string): string {
    const title = productTitle.toLowerCase();

    // Keyword-based semantic matching
    const semanticMatches = [
      {
        keywords: ['rca', 'тюльпан', 'av', 'композитний'],
        connectors: ['hdmi'],
        match: 'Перехідник HDMI-RCA'
      },
      {
        keywords: ['vga', 'монітор', 'дисплей'],
        connectors: ['hdmi'],
        match: 'Перехідник HDMI-VGA'
      },
      {
        keywords: ['displayport', 'dp'],
        connectors: ['hdmi'],
        match: 'Перехідник HDMI-DP'
      },
      {
        keywords: ['scart', 'скарт'],
        connectors: [],
        match: 'Перехідник SCART'
      },
      {
        keywords: ['usb', 'rs232', 'rs-232', 'com', 'serial', 'послідовний'],
        connectors: [],
        match: title.includes('3 м') || title.includes('3м') || title.includes('три м') || title.includes('3 метр') ? 'Кабель USB-RS232 3 метри' : 'Кабель USB-RS232 1.5m'
      },
      {
        keywords: ['консоль', 'console', 'налагодження'],
        connectors: ['usb'],
        match: 'Кабель USB консольний'
      },
      {
        keywords: ['type-c', 'type c', 'usb-c'],
        connectors: [],
        match: 'Кабель USB Type C'
      },
      {
        keywords: ['термопаста', 'thermal', 'paste'],
        connectors: [],
        match: 'Термопаста, 2 гр.'
      }
    ];

    // Check for semantic matches first
    for (const semantic of semanticMatches) {
      const hasKeywords = semantic.keywords.some(keyword => title.includes(keyword));
      const hasConnectors = semantic.connectors.length === 0 || semantic.connectors.some(conn => title.includes(conn));

      if (hasKeywords && hasConnectors) {
        console.log(`Semantic match: "${productTitle}" -> "${semantic.match}"`);
        return semantic.match;
      }
    }

    // Fallback to similarity matching
    let bestMatch = this.productVariants[0];
    let bestScore = 0;

    for (const variant of this.productVariants) {
      const score = this.calculateSimilarity(productTitle, variant);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = variant;
      }
    }

    console.log(`Similarity fallback: "${productTitle}" -> "${bestMatch}" (score: ${bestScore})`);
    return bestMatch;
  }

  private static calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    const matrix = Array(s2.length + 1)
      .fill(null)
      .map(() => Array(s1.length + 1).fill(null));

    for (let i = 0; i <= s1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= s2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= s2.length; j++) {
      for (let i = 1; i <= s1.length; i++) {
        const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    const maxLen = Math.max(s1.length, s2.length);
    return maxLen === 0 ? 1 : (maxLen - matrix[s2.length][s1.length]) / maxLen;
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