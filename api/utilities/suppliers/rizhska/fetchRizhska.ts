import { FetchingFunc } from 'types/index';
import { getPaginatedData } from 'utilities';
import fetch from 'node-fetch';

type SupplierProduct = {
  part_number: string;
  name: string;
  warranty: number | string;
  instock: number;
  priceOpt: number;
};

async function fetchHtmlWithBrowserless(
  url: string
): Promise<SupplierProduct[]> {
  const token = '2Sa6bXRln9OigEmb6617a62ff24639a0e60d979afc2595f06';
  const baseUrl = 'https://production-sfo.browserless.io';

  if (!token) throw new Error('BROWSERLESS_TOKEN is not set');

  try {
    const response = await fetch(`${baseUrl}/function?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: `
          export default async ({ page }) => {
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            // Navigate to the target URL
            await page.goto('${url}', {
              waitUntil: 'networkidle2',
              timeout: 30000
            });

            // Wait for content to load
            await page.waitForSelector('.content', { timeout: 10000 }).catch(() => {
              console.log('Content selector not found, continuing anyway...');
            });

            // Extract products data
            const products = await page.evaluate(() => {
              const contentElems = document.querySelectorAll('.content');
              const extractedProducts = [];

              contentElems.forEach(elem => {
                const content = elem.innerHTML || '';

                // Split by <br> and clean up
                const lines = content
                  .replace(/<br\\s*\\/?>/gi, '\\n')
                  .replace(/&nbsp;/g, ' ')
                  .replace(/&amp;/g, '&')
                  .split('\\n')
                  .map(line => {
                    // Create temporary element to extract text
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = line;
                    return tempDiv.textContent || tempDiv.innerText || '';
                  })
                  .map(line => line.trim())
                  .filter(Boolean);

                for (const line of lines) {
                  const quantityMatch = line.match(/(\\d+)\\s*шт/);
                  const quantity = quantityMatch ? quantityMatch[1] : '1';
                  const priceMatch = line.match(/(\\d+)\\s*грн/);
                  const price = priceMatch ? priceMatch[1] : '';

                  const regexp = /[A-Z0-9А-Я]{6,}-[A-Z0-9]{2,}|[0-9]{2,}\\.[A-Z0-9]{5,}\\.[A-Z0-9]{5,}|[A-Z0-9А-Я]{6,}\\/[A-Z0-9]{1,}|[A-Z0-9]{6,}|[A-Z0-9А-Я]{3}-[A-Z0-9]{3,}\\/[A-Z0-9]{2}/g;
                  const partNumberMatch = line.match(regexp);
                  const partNumber = partNumberMatch ? partNumberMatch[0] : '';

                  const product = {
                    part_number: partNumber,
                    name: line,
                    warranty: 36,
                    instock: parseInt(quantity, 10) || 1,
                    priceOpt: parseInt(price, 10) || 0,
                  };

                  // Filter products containing DDR and meeting criteria
                  if (
                    product.name.includes('DDR') &&
                    !product.name.includes('уехала') &&
                    product.priceOpt > 100 &&
                    product.part_number
                  ) {
                    extractedProducts.push(product);
                  }
                }
              });

              return extractedProducts;
            });

            return { products, success: true, url: '${url}' };
          }
        `,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Browserless request failed: ${response.status} ${errorText}`
      );
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error('Browserless function execution failed');
    }

    console.log(
      `✅ Fetched ${result.products?.length || 0} products from ${url}`
    );
    return result.products || [];
  } catch (error) {
    console.error(`❌ Error fetching from ${url}:`, error);
    throw error;
  }
}

async function fetchRizhskaProducts(): Promise<SupplierProduct[]> {
  const urls = [process.env.RIZHKA_URL_1, process.env.RIZHKA_URL_2].filter(
    Boolean
  ) as string[];

  if (urls.length === 0) {
    throw new Error('No Rizhska URLs configured in environment variables');
  }

  const allProducts: SupplierProduct[] = [];

  for (const url of urls) {
    try {
      const products = await fetchHtmlWithBrowserless(url);
      console.log(
        `📊 Products from ${url}:`,
        JSON.stringify(products.slice(0, 3), null, 2)
      );
      allProducts.push(...products);
    } catch (error) {
      console.error(`⚠️ Failed to fetch from ${url}:`, error);
      // Continue with other URLs even if one fails
    }
  }

  if (allProducts.length < 1) {
    throw new Error('Less than 1 products found from Rizhska');
  }

  console.log(`📈 Total products collected: ${allProducts.length}`);
  return allProducts;
}

export async function fetchRizhska({ query, limit, page }: FetchingFunc) {
  console.debug('🚀 [fetchRizhska] called with:', { query, limit, page });

  let allProducts: SupplierProduct[] = [];

  try {
    allProducts = await fetchRizhskaProducts();
    console.debug(
      '📦 [fetchRizhska] fetched products count:',
      allProducts.length
    );
  } catch (err) {
    console.error('❌ [fetchRizhska] Error fetching products:', err);
    throw err;
  }

  // Defensive: ensure query is a string
  if (typeof query !== 'string') {
    console.warn('⚠️ [fetchRizhska] query is not a string:', query);
    query = '';
  }

  const words = query
    .toLowerCase()
    .split(' ')
    .filter((word) => word);

  console.debug('🔍 [fetchRizhska] search words:', words);

  const products = allProducts
    .filter(
      ({ instock, part_number, name }) =>
        words.every((word) => name.toLowerCase().includes(word)) &&
        instock &&
        part_number
    )
    .map((prod) => ({
      name: 'dimm/sodimm ' + prod.part_number,
      part_number: prod.part_number.toLowerCase(),
      price: prod.priceOpt,
      instock: prod.instock,
      id: prod.part_number,
      warranty: prod.warranty,
    }));

  return {
    products: getPaginatedData(products, Number(limit), Number(page)),
    count: products.length,
  };
}
