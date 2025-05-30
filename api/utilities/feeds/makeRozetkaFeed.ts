import { GenericProductFeed } from 'api/routes/GET-feeds';
import { IN_STOCK } from '../data/stockStatus';

const stopBrands = [
  'Kingston',
  'Samsung',
  'Xiaomi',
  'Tefal',
  'Kingston Fury (ex.HyperX)',
];
const rozetkaSuppliers = ['щу', 'ии', 'че'];
const DEFAULT_CATEGORY_MAPPING = {
  "Пам'ять оперативна": 'c80081',
  'USB-RS232': 'c80073',
  'Аудіо перехідники оптика - тюльпани': 'c80073',
  'HDMI - VGA': 'c80073',
  'HDMI-RCA': 'c80073',
  'Світлодіодні стрічки': 'c234721',
  'USB Type C': 'c80073',
  'RCA-3.5mm': 'c80073',
  'HDMI-DisplayPort': 'c80073',
  'USB кабелі': 'c80073',
  'Зарядні пристрої': 'c146341',
  'VGA-RCA': 'c80073',
  'Перехідники для зарядки ноутбуків та роутерів': 'c80073',
  'HDMI-SCART': 'c80073',
  'карти відеозахвату usb': 'c82249',
};

const ROZETKA_DEFAULT_PARAMS: Record<
  string,
  Array<{ paramName: string; paramValue: string }>
> = {
  'перехідники для зарядки ноутбуків та роутерів': [
    {
      paramName: 'Тип коннектора 2',
      paramValue: 'DC connector',
    },
    {
      paramName: 'Призначення',
      paramValue:
        'Для блоков питания,Ноутбук,Для роутерів,мережевий зарядний пристрій',
    },
    {
      paramName: 'Тип',
      paramValue: 'Кабелі зарядки',
    },
    {
      paramName: 'Гарантія',
      paramValue: '12 мясяців',
    },
  ],
  'hdmi - vga': [
    {
      paramName: 'Тип коннектора 1',
      paramValue: 'VGA',
    },
    {
      paramName: 'Тип коннектора 2',
      paramValue: 'HDMI',
    },
  ],
  'hdmi-rca': [
    {
      paramName: 'Тип коннектора 2',
      paramValue: 'Композитний (RCA-jack)',
    },
    {
      paramName: 'Тип коннектора 1',
      paramValue: 'HDMI',
    },
  ],
  'HDMI-DisplayPort': [
    {
      paramName: 'Тип коннектора 1',
      paramValue: 'HDMI',
    },
    {
      paramName: 'Тип коннектора 2',
      paramValue: 'DisplayPort',
    },
  ],
  'карти відеозахвату usb': [
    {
      paramName: 'Інтерфейс',
      paramValue: 'USB',
    },
    {
      paramName: 'Тип',
      paramValue: 'Зовнішній',
    },
    {
      paramName: 'Сумісність',
      paramValue: 'ПК,Mac OS X',
    },
    {
      paramName: 'Гарантія',
      paramValue: '12 мясяців',
    },
  ],
};

export const makeRozetkaFeed = (products: GenericProductFeed[]) => {
  const date = new Date().toISOString().slice(0, 16).replace('T', ' ');

  const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>\n`;

  const filteredProducts = products.filter((product) => {
    const supplier = product.sku.split('^')[1] || '';
    return (
      !stopBrands.includes(product.brand) &&
      rozetkaSuppliers.includes(supplier.toLowerCase())
    );
  });

  const categoryIds = [
    ...new Set(filteredProducts.map((product) => parseCategoryId(product))),
  ];

  const categoriesSection = categoryIds
    .map(
      (categoryId) => `<category id="${categoryId}">Category Name</category>`
    )
    .join('\n');

  const shopInfo = `
        <yml_catalog date="${date}">
          <shop>
            <name>INTERRA</name>
            <company>INTERRA</company>
            <url>https://informatica.com.ua/</url>
            <currencies>
              <currency id="UAH" rate="1"/>
            </currencies>
            <categories>
              ${categoriesSection}
            </categories>
            <offers>
      `;

  const offers = filteredProducts
    .map((product) => {
      const { categoryId, params } = parseRozetkaFilter(product);

      const isMemory = product.collection.toLowerCase().includes("пам'ять");
      const hasSpecialTitle =
        product.title.includes('Перехідник аудіо-оптика на 3.5 мм') ||
        product.title.includes('232');
      const priceMultiplier = hasSpecialTitle ? 1.08 : isMemory ? 1.03 : 1.21;

      const price = product.price * priceMultiplier;

      const oldPrice = (price * 1.1).toFixed(2);
      const state = isMemory ? 'used' : 'new';
      const name = isMemory
        ? "Оперативна пам'ять " + product.title + ' б/в'
        : product.title;

      const additionalImages = product.imageURLs
        .slice(1, 11)
        .map((url) => `<picture>${url}</picture>`)
        .join('');

      const paramsSection = params
        .map(
          ({ paramName, paramValue }) =>
            `<param name="${paramName}">${paramValue}</param>`
        )
        .join('');

      const oldRozetkaMemoryId =
        isMemory && product.id_woocommerce
          ? product.id_woocommerce + '-1'
          : product.id_woocommerce;
      const id = oldRozetkaMemoryId || product.id;
      const brand = name.toLowerCase().includes('easycap')
        ? 'Easycap'
        : product.brand;

      return `
          <offer id="${id}" available="${product.availability === IN_STOCK}">
            <name>${name}</name>
            <price>${price}</price>
            <price_old>${oldPrice}</price_old>
            <url>${product.link}</url>
            <stock_quantity>${product.inventoryQuantity || 0}</stock_quantity>
            <currencyId>UAH</currencyId>
            <categoryId>${categoryId}</categoryId>
            <vendor>${brand}</vendor>
            <state>${state}</state>
            <picture>${product.imageURLs[0]}</picture>
            ${additionalImages}
            ${paramsSection}
            <description><![CDATA[${product.description}]]></description>
          </offer>
        `;
    })
    .join('');

  const shopClose = `
            </offers>
          </shop>
        </yml_catalog>
      `;

  return xmlHeader + shopInfo + offers + shopClose;
};

const parseCategoryId = (product: GenericProductFeed) => {
  const rozetka_filter = product.rozetka_filter;
  if (typeof rozetka_filter !== 'string' || !rozetka_filter.trim()) {
    return getDefaultCategoryId(product);
  }

  const match = rozetka_filter.match(/^c\d+/);
  return match ? match[0] : getDefaultCategoryId(product);
};

const parseRozetkaFilter = (product: GenericProductFeed) => {
  const rozetka_filter = product.rozetka_filter;
  if (
    !rozetka_filter ||
    typeof rozetka_filter !== 'string' ||
    !rozetka_filter.trim()
  ) {
    const fallbackCategoryId = getDefaultCategoryId(product);
    return {
      categoryId: fallbackCategoryId,
      params: getRozetkaDefaultParams(product),
    };
  }

  const [categoryId, paramsString] = rozetka_filter
    .split(':')
    .map((item) => item.trim());

  let params: string | any[] = [];
  if (paramsString) {
    params = paramsString
      .split(';')
      .map((param) => param.trim())
      .filter(Boolean)
      .map((param) => {
        const [paramName, paramValue] = param
          .split(/[=~]/)
          .map((item) => item && item.trim());
        return {
          paramName: paramName || 'unknown',
          paramValue: paramValue || 'unknown',
        };
      });
  }

  if (params.length === 0) {
    params = getRozetkaDefaultParams(product);
  }

  return { categoryId, params };
};

const getDefaultCategoryId = (product: GenericProductFeed) => {
  const lowerCaseCollection = product.collection.toLowerCase();

  for (const [key, value] of Object.entries(DEFAULT_CATEGORY_MAPPING)) {
    if (lowerCaseCollection.includes(key.toLowerCase())) {
      return value;
    }
  }

  return 'c4670691';
};

const getRozetkaDefaultParams = (
  product: GenericProductFeed
): Array<{ paramName: string; paramValue: string }> => {
  const lowerCaseCollection = product.collection.toLowerCase();
  const lowerCaseTitle = product.title.toLowerCase();
  let params: Array<{ paramName: string; paramValue: string }> = [];

  for (const [key, defaultParams] of Object.entries(ROZETKA_DEFAULT_PARAMS)) {
    if (lowerCaseCollection.includes(key.toLowerCase())) {
      params = [...defaultParams];
      break;
    }
  }

  if (lowerCaseTitle.includes('type')) {
    params.push({
      paramName: 'Тип коннектора 1',
      paramValue: 'USB Type-C',
    });
  }
  return params;
};
