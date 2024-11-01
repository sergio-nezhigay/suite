const stopBrands = ['Kingston', 'Samsung'];
const rozetkaSuppliers = ['щу', 'ии', 'ри', 'че'];

export const makeRozetkaFeed = (products) => {
  const date = new Date().toISOString().slice(0, 16).replace('T', ' ');

  const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>\n`;

  // Filter out products without rozetka_filter
  const filteredProducts = products.filter((product) => {
    const supplier = product.sku.split('^')[1] || '';
    return (
      typeof product.rozetka_filter === 'string' &&
      product.rozetka_filter.trim() &&
      !stopBrands.includes(product.brand) &&
      rozetkaSuppliers.includes(supplier.toLowerCase())
    );
  });

  // Extract unique categoryIds from products' rozetka_filter
  const categoryIds = [
    ...new Set(
      filteredProducts.map((product) => parseCategoryId(product.rozetka_filter))
    ),
  ];

  // Build the categories section using the unique categoryIds
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
      const { categoryId, params } = parseRozetkaFilter(product.rozetka_filter);

      // Calculate oldPrice as 10% higher than the price

      const isMemory = product.collection.toLowerCase().includes("пам'ять");
      const price = isMemory ? product.price * 1.04 : product.price * 1.05;
      const oldPrice = (price * 1.1).toFixed(2);
      const state = isMemory ? 'used' : 'new';
      const name = isMemory ? product.title + ' б/в' : product.title;

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

      const oldRozetkaId = isMemory
        ? product.id_woocommerce + '-1'
        : product.id_woocommerce;
      const id = oldRozetkaId || product.id;

      return `
          <offer id="${id}" available="${product.availability === 'in stock'}">
            <name>${name}</name>
            <price>${price}</price>
            <price_old>${oldPrice}</price_old>
            <url>${product.link}</url>
            <stock_quantity>${product.inventoryQuantity || 0}</stock_quantity>
            <currencyId>UAH</currencyId>
            <categoryId>${categoryId}</categoryId>
            <vendor>${product.brand}</vendor>
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

// Function to extract categoryId from rozetka_filter string
const parseCategoryId = (rozetka_filter) => {
  if (typeof rozetka_filter !== 'string') {
    return 'unknown';
  }
  const match = rozetka_filter.match(/^c\d+/);
  return match ? match[0] : 'unknown';
};

const parseRozetkaFilter = (rozetka_filter) => {
  const [categoryId, paramsString] = rozetka_filter
    .split(':')
    .map((item) => item.trim());

  if (!paramsString) {
    return { categoryId, params: [] };
  }

  const params = paramsString
    .split(';')
    .map((param) => param.trim())
    .filter(Boolean)
    .map((param) => {
      const [paramName, paramValue] = param
        .split(/[=~]/)
        .map((item) => item && item.trim());

      if (!paramName) {
        return { paramName: 'unknown', paramValue: '' };
      }

      return { paramName, paramValue: paramValue || 'unknown' };
    });

  return { categoryId, params };
};
