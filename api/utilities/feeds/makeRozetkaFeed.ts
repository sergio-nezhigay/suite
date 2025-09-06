import { GenericProductFeed } from 'api/routes/GET-feeds';

interface RozetkaParam {
  paramName: string;
  paramValue: string;
}

interface RozetkaProductConfig {
  categoryId: string;
  params: RozetkaParam[];
}

interface CategoryRule {
  keywords: string[];
  categoryId: string;
  defaultParams?: RozetkaParam[];
  multiplier?: number;
}

interface TitleRule {
  condition: (product: GenericProductFeed) => boolean;
  transform: (product: GenericProductFeed) => string;
}

interface StateRule {
  condition: (product: GenericProductFeed) => boolean;
  state: 'new' | 'used';
}

const ROZETKA_CONFIG = {
  suppliers: {
    allowed: ['щу', 'ии', 'че'] as string[],
    blocked: [
      'Kingston',
      'Samsung',
      'Xiaomi',
      'Tefal',
      'Kingston Fury (ex.HyperX)',
    ] as string[],
  },

  categories: {
    rules: [
      {
        keywords: ["пам'ять оперативна"],
        categoryId: 'c80081',
        defaultParams: [
          { paramName: 'Тип', paramValue: "Оперативна пам'ять" },
          { paramName: 'Гарантія', paramValue: '12 місяців' },
        ],
        multiplier: 1,
      },
      {
        keywords: ['usb-rs232', 'rs485', 'оптичні аудіо перехідники'],
        categoryId: 'c80073',
        defaultParams: [
          { paramName: 'Тип', paramValue: 'Перехідник' },
          { paramName: 'Гарантія', paramValue: '12 місяців' },
        ],
        multiplier: 1.12,
      },
      {
        keywords: [
          'hdmi - vga',
          'hdmi-rca',
          'usb type c',
          'rca-3.5mm',
          'hdmi-displayport',
          'usb аксесуари',
          'vga-rca',
          'hdmi-scart',
        ],
        categoryId: 'c80073',
        defaultParams: [
          { paramName: 'Тип', paramValue: 'Кабель/Перехідник' },
          { paramName: 'Гарантія', paramValue: '12 місяців' },
        ],
        multiplier: 1.17,
      },
      {
        keywords: ['перехідники для зарядки ноутбуків та роутерів'],
        categoryId: 'c80073',
        defaultParams: [
          { paramName: 'Тип коннектора 2', paramValue: 'DC connector' },
          {
            paramName: 'Призначення',
            paramValue:
              'Для блоков питания,Ноутбук,Для роутерів,мережевий зарядний пристрій',
          },
          { paramName: 'Тип', paramValue: 'Кабелі зарядки' },
          { paramName: 'Гарантія', paramValue: '12 місяців' },
        ],
        multiplier: 1.22,
      },
      {
        keywords: ['світлодіодні стрічки'],
        categoryId: 'c234721',
        defaultParams: [
          { paramName: 'Тип', paramValue: 'LED стрічка' },
          { paramName: 'Гарантія', paramValue: '12 місяців' },
        ],
        multiplier: 1.22,
      },
      {
        keywords: ['зарядні пристрої'],
        categoryId: 'c146341',
        defaultParams: [
          { paramName: 'Тип', paramValue: 'Зарядний пристрій' },
          { paramName: 'Гарантія', paramValue: '12 місяців' },
        ],
        multiplier: 1.18,
      },
      {
        keywords: ['карти відеозахвату usb'],
        categoryId: 'c82249',
        defaultParams: [
          { paramName: 'Інтерфейс', paramValue: 'USB' },
          { paramName: 'Тип', paramValue: 'Зовнішній' },
          { paramName: 'Сумісність', paramValue: 'ПК,Mac OS X' },
          { paramName: 'Гарантія', paramValue: '12 місяців' },
        ],
        multiplier: 1.19,
      },
    ] as CategoryRule[],
    fallback: {
      categoryId: 'c4670691',
      defaultParams: [{ paramName: 'Гарантія', paramValue: '12 місяців' }],
      multiplier: 1.23,
    },
  },

  connectorTypes: {
    patterns: [
      {
        keywords: ['type c', 'type-c'],
        paramName: 'Тип коннектора 1',
        paramValue: 'USB Type-C',
      },
      { keywords: ['usb'], paramName: 'Тип коннектора 1', paramValue: 'USB' },
      {
        keywords: ['metal'],
        paramName: 'Тип коннектора 1',
        paramValue: 'Metal',
      },
      {
        keywords: ['rs232'],
        paramName: 'Тип коннектора 2',
        paramValue: 'COM-порт',
      },
      { keywords: ['hdmi'], paramName: 'Тип коннектора 1', paramValue: 'HDMI' },
      { keywords: ['vga'], paramName: 'Тип коннектора 2', paramValue: 'VGA' },
      {
        keywords: ['rca'],
        paramName: 'Тип коннектора 2',
        paramValue: 'Композитний (RCA-jack)',
      },
      {
        keywords: ['displayport'],
        paramName: 'Тип коннектора 2',
        paramValue: 'DisplayPort',
      },
    ],
  },

  productState: {
    rules: [
      {
        condition: (product: GenericProductFeed) =>
          product.collection.toLowerCase().includes("пам'ять"),
        state: 'used' as const,
      },
    ] as StateRule[],
    default: 'new' as const,
  },

  // Title transformation rules
  titleTransform: {
    rules: [
      {
        condition: (product: GenericProductFeed) =>
          product.collection.toLowerCase().includes("пам'ять"),
        transform: (product: GenericProductFeed) =>
          `Оперативна пам'ять ${product.title} б/в`,
      },
    ] as TitleRule[],
    default: (product: GenericProductFeed) => product.title,
  },

  // Brand override rules
  brandOverride: {
    rules: [
      {
        condition: (product: GenericProductFeed) =>
          product.title.toLowerCase().includes('easycap'),
        brand: 'Easycap',
      },
    ],
  },

  // Stock status handling
  stockStatus: {
    getAvailability: (product: GenericProductFeed) => {
      const quantity = product.inventoryQuantity || 0;
      return quantity > 0 ? 'true' : 'false';
    },
    getStockQuantity: (product: GenericProductFeed) => {
      return Math.max(0, product.inventoryQuantity || 0);
    },
  },

  // XML generation settings
  xml: {
    maxAdditionalImages: 10,
    currency: 'UAH',
    shopInfo: {
      name: 'INTERRA',
      company: 'INTERRA',
      url: 'https://informatica.com.ua/',
    },
  },
} as const;

// Helper classes for better organization
class RozetkaProductProcessor {
  static isProductAllowed(product: GenericProductFeed): boolean {
    const supplier = product.sku.split('^')[1] || '';

    return (
      !ROZETKA_CONFIG.suppliers.blocked.includes(product.brand) &&
      ROZETKA_CONFIG.suppliers.allowed.includes(supplier.toLowerCase())
    );
  }

  static getCategoryConfig(product: GenericProductFeed): {
    categoryId: string;
    params: RozetkaParam[];
    multiplier?: number;
  } {
    const lowerCaseCollection = product.collection.toLowerCase();

    // Find matching category rule
    const matchingRule = ROZETKA_CONFIG.categories.rules.find((rule) =>
      rule.keywords.some((keyword) =>
        lowerCaseCollection.includes(keyword.toLowerCase())
      )
    );

    if (matchingRule) {
      return {
        categoryId: matchingRule.categoryId,
        params: [...(matchingRule.defaultParams || [])],
        multiplier: matchingRule.multiplier,
      };
    }

    // Fallback to default category
    return {
      categoryId: ROZETKA_CONFIG.categories.fallback.categoryId,
      params: [...ROZETKA_CONFIG.categories.fallback.defaultParams],
      multiplier: ROZETKA_CONFIG.categories.fallback.multiplier,
    };
  }

  static generateDynamicParams(product: GenericProductFeed): RozetkaParam[] {
    const lowerCaseTitle = product.title.toLowerCase();
    const dynamicParams: RozetkaParam[] = [];

    // Sort patterns by longest keyword first
    const sortedPatterns = [...ROZETKA_CONFIG.connectorTypes.patterns].sort(
      (a, b) => {
        const maxA = Math.max(...a.keywords.map((k) => k.length));
        const maxB = Math.max(...b.keywords.map((k) => k.length));
        return maxB - maxA;
      }
    );

    sortedPatterns.forEach((pattern) => {
      if (
        pattern.keywords.some((keyword) =>
          lowerCaseTitle.includes(keyword.toLowerCase())
        )
      ) {
        // Only add if paramName not already present (from a more specific match)
        if (!dynamicParams.some((p) => p.paramName === pattern.paramName)) {
          dynamicParams.push({
            paramName: pattern.paramName,
            paramValue: pattern.paramValue,
          });
        }
      }
    });

    return dynamicParams;
  }

  static calculatePrice(product: GenericProductFeed): {
    price: number;
    oldPrice: string;
  } {
    const titleExclusion = ['Перехідник аудіо-оптика на 3.5 мм'];
    const title = product.title.toLowerCase();
    const isExcluded = titleExclusion.some((ex) =>
      title.includes(ex.toLowerCase())
    );

    const categoryConfig = RozetkaProductProcessor.getCategoryConfig(product);
    const categoryMultiplier = categoryConfig.categoryId
      ? categoryConfig.multiplier
      : undefined;

    const multiplier = isExcluded ? 1.08 : categoryMultiplier ?? 1.23;

    const price = product.price * multiplier;
    const oldPrice = (price * 1.11).toFixed(2);

    return { price, oldPrice };
  }

  static getProductState(product: GenericProductFeed): 'new' | 'used' {
    const matchingRule = ROZETKA_CONFIG.productState.rules.find((rule) =>
      rule.condition(product)
    );
    return matchingRule?.state || ROZETKA_CONFIG.productState.default;
  }

  static transformTitle(product: GenericProductFeed): string {
    const matchingRule = ROZETKA_CONFIG.titleTransform.rules.find((rule) =>
      rule.condition(product)
    );
    return (
      matchingRule?.transform(product) ||
      ROZETKA_CONFIG.titleTransform.default(product)
    );
  }

  static getBrand(product: GenericProductFeed): string {
    const matchingRule = ROZETKA_CONFIG.brandOverride.rules.find((rule) =>
      rule.condition(product)
    );
    return matchingRule?.brand || product.brand;
  }

  static getProductId(product: GenericProductFeed): string {
    const isMemory = product.collection.toLowerCase().includes("пам'ять");
    const oldRozetkaMemoryId =
      isMemory && product.id_woocommerce
        ? product.id_woocommerce + '-1'
        : product.id_woocommerce;
    return oldRozetkaMemoryId || product.id;
  }
}

class RozetkaFilterParser {
  static parseRozetkaFilter(product: GenericProductFeed): RozetkaProductConfig {
    const rozetka_filter = product.rozetka_filter;

    if (
      !rozetka_filter ||
      typeof rozetka_filter !== 'string' ||
      !rozetka_filter.trim()
    ) {
      return this.getFallbackConfig(product);
    }

    const [categoryId, paramsString] = rozetka_filter
      .split(':')
      .map((item) => item.trim());

    if (!categoryId.match(/^c\d+/)) {
      return this.getFallbackConfig(product);
    }

    let params: RozetkaParam[] = [];
    if (paramsString) {
      params = this.parseParamsString(paramsString);
    }

    // If no params found, use default params
    if (params.length === 0) {
      const categoryConfig = RozetkaProductProcessor.getCategoryConfig(product);
      params = categoryConfig.params;
    }

    // Add dynamic params
    const dynamicParams =
      RozetkaProductProcessor.generateDynamicParams(product);

    params = [
      ...params.filter((param) =>
        dynamicParams.every(
          (dynamicParam) => dynamicParam.paramName !== param.paramName
        )
      ),
      ...dynamicParams,
    ];

    return { categoryId, params };
  }

  private static parseParamsString(paramsString: string): RozetkaParam[] {
    return paramsString
      .split(';')
      .map((param) => param.trim())
      .filter(Boolean)
      .map((param) => {
        const [paramName, paramValue] = param
          .split(/[=~]/)
          .map((item) => item?.trim());
        return {
          paramName: paramName || 'unknown',
          paramValue: paramValue || 'unknown',
        };
      });
  }

  private static getFallbackConfig(
    product: GenericProductFeed
  ): RozetkaProductConfig {
    const categoryConfig = RozetkaProductProcessor.getCategoryConfig(product);
    const dynamicParams =
      RozetkaProductProcessor.generateDynamicParams(product);

    return {
      categoryId: categoryConfig.categoryId,
      params: [...categoryConfig.params, ...dynamicParams],
    };
  }
}

class RozetkaXMLGenerator {
  static generateXML(products: GenericProductFeed[]): string {
    const date = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>\n<yml_catalog date="${date}">\n`;

    const filteredProducts = products.filter(
      RozetkaProductProcessor.isProductAllowed
    );
    const categoryIds = [
      ...new Set(
        filteredProducts.map((product) => {
          const config = RozetkaFilterParser.parseRozetkaFilter(product);
          return config.categoryId;
        })
      ),
    ];

    const categoriesSection = categoryIds
      .map(
        (categoryId) => `<category id="${categoryId}">Category Name</category>`
      )
      .join('\n');

    const shopInfo = this.generateShopInfo(categoriesSection);
    const offers = this.generateOffers(filteredProducts);
    const shopClose = `\n        </offers>\n      </shop>\n    </yml_catalog>`;

    return xmlHeader + shopInfo + offers + shopClose;
  }

  private static generateShopInfo(categoriesSection: string): string {
    const config = ROZETKA_CONFIG.xml.shopInfo;
    return `
    <shop>
      <name>${config.name}</name>
      <company>${config.company}</company>
      <url>${config.url}</url>
      <currencies>
        <currency id="${ROZETKA_CONFIG.xml.currency}" rate="1"/>
      </currencies>
      <categories>
        ${categoriesSection}
      </categories>
      <offers>`;
  }

  private static generateOffers(products: GenericProductFeed[]): string {
    return products
      .map((product) => {
        const config = RozetkaFilterParser.parseRozetkaFilter(product);
        const { price, oldPrice } =
          RozetkaProductProcessor.calculatePrice(product);
        const state = RozetkaProductProcessor.getProductState(product);
        const name = RozetkaProductProcessor.transformTitle(product);
        const brand = RozetkaProductProcessor.getBrand(product);
        const id = RozetkaProductProcessor.getProductId(product);

        const additionalImages = product.imageURLs
          .slice(1, ROZETKA_CONFIG.xml.maxAdditionalImages + 1)
          .map((url) => `<picture>${url}</picture>`)
          .join('');

        const paramsSection = config.params
          .map(
            ({ paramName, paramValue }) =>
              `<param name="${paramName}">${paramValue}</param>`
          )
          .join('');

        return `
        <offer id="${id}" available="${ROZETKA_CONFIG.stockStatus.getAvailability(
          product
        )}">
          <name>${name}</name>
          <price>${price}</price>
          <price_old>${oldPrice}</price_old>
          <url>${product.link}</url>
          <stock_quantity>${product.inventoryQuantity || 0}</stock_quantity>
          <currencyId>${ROZETKA_CONFIG.xml.currency}</currencyId>
          <categoryId>${config.categoryId}</categoryId>
          <vendor>${brand}</vendor>
          <state>${state}</state>
          <picture>${product.imageURLs[0]}</picture>
          ${additionalImages}
          ${paramsSection}
          <description><![CDATA[${product.description}]]></description>
        </offer>`;
      })
      .join('');
  }
}

// Main export function - simplified and clean
export const makeRozetkaFeed = (products: GenericProductFeed[]): string => {
  return RozetkaXMLGenerator.generateXML(products);
};
