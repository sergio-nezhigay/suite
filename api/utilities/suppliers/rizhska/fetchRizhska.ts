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
  const baseUrl = 'https://production-sfo.browserless.io';

  try {
    console.log(`🔄 Starting fetch for URL: ${url}`);

    const response = await fetch(
      `${baseUrl}/function?token=${process.env.BROWSERLESS_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: `
          export default async ({ page }) => {
            const logs = [];
            const originalLog = console.log;
            console.log = (...args) => {
                logs.push(args.join(' '));
                originalLog(...args);
            };

            console.log('🌐 Page navigation starting...');

            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            // Navigate to the target URL
            try {
              await page.goto('${url}', {
                waitUntil: 'networkidle2',
                timeout: 30000
              });
              console.log('✅ Page navigation successful');
            } catch (navError) {
              console.error('❌ Navigation failed:', navError.message);
              return { products: [], success: false, error: 'Navigation failed', url: '${url}' };
            }

            // Check if page loaded correctly
            const pageTitle = await page.title();
            const pageUrl = page.url();
            console.log('📄 Page title:', pageTitle);
            console.log('🔗 Current URL:', pageUrl);

            // If Cloudflare or similar interstitial detected, wait a bit
            if (pageTitle === 'Just a moment...') {
              console.log('⏳ Detected interstitial page, waiting 5 seconds...');
              await new Promise(res => setTimeout(res, 5000));
              // Optionally, re-check title and log
              const newTitle = await page.title();
              console.log('🔄 New page title after wait:', newTitle);
            }

            // Wait for content to load with better error handling
            let contentSelector = '.content';
            let contentFound = false;

            try {
              await page.waitForSelector('.content', { timeout: 10000 });
              contentFound = true;
              console.log('✅ Content selector found');
            } catch (selectorError) {
              console.log('⚠️ Content selector not found, checking alternatives...');

              // Try alternative selectors
              const possibleSelectors = [
                '[class*="content"]',
                '.post-content',
                '.message-content',
                '.post',
                '.message',
                'main',
                '.main',
                'body'
              ];

              for (const selector of possibleSelectors) {
                try {
                  const found = await page.$(selector);
                  if (found) {
                    console.log(\`✅ Found alternative selector: \${selector}\`);
                    contentSelector = selector;
                    contentFound = true;
                    break;
                  }
                } catch (e) {
                  // Continue to next selector
                }
              }
            }

            if (!contentFound) {
              // Get page HTML for debugging
              const bodyHTML = await page.evaluate(() => document.body.innerHTML);
              console.log('📝 Page HTML preview (first 500 chars):', bodyHTML.substring(0, 500));

              return {
                products: [],
                success: false,
                error: 'No content elements found',
                pageHTML: bodyHTML.substring(0, 1000),
                url: '${url}'
              };
            }

            // Extract products data with enhanced debugging
            const products = await page.evaluate((selector) => {
              console.log('🔍 Starting product extraction with selector:', selector);

              const contentElems = document.querySelectorAll(selector);
              console.log('📊 Found content elements:', contentElems.length);

              if (contentElems.length === 0) {
                console.log('❌ No elements found with selector:', selector);
                return [];
              }

              const extractedProducts = [];
              let totalLines = 0;

              contentElems.forEach((elem, elemIndex) => {
                // Log the raw HTML of the element for debugging
                console.log(\`🧩 Element \${elemIndex} outerHTML (first 500 chars):\`, elem.outerHTML.substring(0, 500));

                const content = elem.innerHTML || '';
                console.log(\`📝 Element \${elemIndex} content length:\`, content.length);

                if (content.length === 0) {
                  console.log(\`⚠️ Element \${elemIndex} is empty\`);
                  return;
                }

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

                totalLines += lines.length;
                console.log(\`📄 Element \${elemIndex} lines:\`, lines.length);
                // Log all lines for debugging
                lines.forEach((line, lineIndex) => {
                  console.log(\`🔹 [Elem \${elemIndex} Line \${lineIndex}] \${line}\`);
                });

                lines.forEach((line, lineIndex) => {
                  // Log regex matches for debugging
                  const quantityMatch = line.match(/(\\d+)\\s*шт/);
                  const priceMatch = line.match(/(\\d+)\\s*грн/);
                  const regexp = /[A-Z0-9А-Я]{6,}-[A-Z0-9]{2,}|[0-9]{2,}\\.[A-Z0-9]{5,}\\.[A-Z0-9]{5,}|[A-Z0-9А-Я]{6,}\\/[A-Z0-9]{1,}|[A-Z0-9]{6,}|[A-Z0-9А-Я]{3}-[A-Z0-9]{3,}\\/[A-Z0-9]{2}/g;
                  const partNumberMatch = line.match(regexp);

                  console.log(\`🔸 [Elem \${elemIndex} Line \${lineIndex}] quantityMatch:\`, quantityMatch, 'priceMatch:', priceMatch, 'partNumberMatch:', partNumberMatch);

                  const quantity = quantityMatch ? quantityMatch[1] : '1';
                  const price = priceMatch ? priceMatch[1] : '';
                  const partNumber = partNumberMatch ? partNumberMatch[0] : '';

                  const product = {
                    part_number: partNumber,
                    name: line,
                    warranty: 36,
                    instock: parseInt(quantity, 10) || 1,
                    priceOpt: parseInt(price, 10) || 0,
                  };

                  // Debug logging for filtering conditions
                  const hasDDR = product.name.includes('DDR');
                  const notUehala = !product.name.includes('уехала');
                  const priceOk = product.priceOpt > 100;
                  const hasPartNumber = !!product.part_number;

                  // Log all lines, not just DDR, for debugging
                  console.log(\`🔍 [Elem \${elemIndex} Line \${lineIndex}] analysis:\`, {
                    line: line.substring(0, 50) + (line.length > 50 ? '...' : ''),
                    hasDDR,
                    notUehala,
                    priceOk,
                    hasPartNumber,
                    price: product.priceOpt,
                    partNumber: product.part_number
                  });

                  // Optionally, for debugging, push all products (remove filter temporarily)
                  // extractedProducts.push(product);

                  // Filter products containing DDR and meeting criteria
                  if (hasDDR && notUehala && priceOk && hasPartNumber) {
                    extractedProducts.push(product);
                    console.log(\`✅ Product added:\`, product.name.substring(0, 50));
                  }
                });
              });

              console.log(\`📊 Extraction summary:\`);
              console.log(\`  - Total lines processed: \${totalLines}\`);
              console.log(\`  - Products extracted: \${extractedProducts.length}\`);

              if (extractedProducts.length > 0) {
                console.log(\`📋 First extracted product:\`, extractedProducts[0]);
              }

              return extractedProducts;
            }, contentSelector);

            console.log(\`🎯 Final result: \${products.length} products extracted\`);
            return { products, success: true, url: '${url}', logs };
          }
        `,
        }),
      }
    );

    console.log(`📡 Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Browserless HTTP error: ${response.status}`);
      console.error(`📄 Error response: ${errorText}`);
      throw new Error(
        `Browserless request failed: ${response.status} ${errorText}`
      );
    }

    const result = await response.json();
    console.log('📦 Browserless result keys:', Object.keys(result));
    console.log('📦 Browserless logged info:', result.logs);
    console.log('✅ Success status:', result.success);

    if (result.error) {
      console.error('❌ Browserless execution error:', result.error);
      if (result.pageHTML) {
        console.log('📄 Page HTML sample:', result.pageHTML);
      }
    }

    if (!result.success) {
      throw new Error(
        `Browserless function execution failed: ${
          result.error || 'Unknown error'
        }`
      );
    }

    console.log(
      `✅ Fetched ${result.products?.length || 0} products from ${url}`
    );

    // Log sample products for debugging
    if (result.products && result.products.length > 0) {
      console.log(
        '📋 Sample products:',
        JSON.stringify(result.products.slice(0, 2), null, 2)
      );
    }

    return result.products || [];
  } catch (error) {
    console.error(`❌ Error fetching from ${url}:`, error);
    console.error('📍 Error stack:', error);
    throw error;
  }
}

async function fetchRizhskaProducts(): Promise<SupplierProduct[]> {
  console.log('🚀 Starting fetchRizhskaProducts...');

  const urls = [process.env.RIZHKA_URL_1].filter(Boolean) as string[];
  //  const urls = [process.env.RIZHKA_URL_1, process.env.RIZHKA_URL_2].filter(
  //    Boolean
  //  ) as string[];

  console.log('🔗 Configured URLs:', urls.length);
  urls.forEach((url, index) => {
    console.log(`  URL ${index + 1}: ${url}`);
  });

  if (urls.length === 0) {
    throw new Error('No Rizhska URLs configured in environment variables');
  }

  const allProducts: SupplierProduct[] = [];

  for (const [index, url] of urls.entries()) {
    console.log(`\n🔄 Processing URL ${index + 1}/${urls.length}: ${url}`);

    try {
      const products = await fetchHtmlWithBrowserless(url);
      console.log(`📊 Products from URL ${index + 1}:`, products.length);

      if (products.length > 0) {
        console.log(
          '📋 Sample products from this URL:',
          JSON.stringify(products.slice(0, 2), null, 2)
        );
      }

      allProducts.push(...products);
    } catch (error) {
      console.error(`⚠️ Failed to fetch from URL ${index + 1}:`, error);
      // Continue with other URLs even if one fails
    }
  }

  console.log(`\n📈 Total products collected: ${allProducts.length}`);
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

  const filteredProducts = allProducts.filter(
    ({ instock, part_number, name }) => {
      const matchesQuery = words.every((word) =>
        name.toLowerCase().includes(word)
      );
      const hasStock = !!instock;
      const hasPartNumber = !!part_number;

      return matchesQuery && hasStock && hasPartNumber;
    }
  );

  console.debug(
    '🎯 [fetchRizhska] filtered products count:',
    filteredProducts.length
  );

  const products = filteredProducts.map((prod) => ({
    name: prod.name
      .replace(/\d+\s*(грн|uah|₴)/gi, '')
      .replace(
        /(есть|в наличии|наличие|пары|новые|новий|нові|нове|радиаторная|б\/у|бу)/gi,
        ''
      )
      .replace(/\d+\s*(шт|штук?)\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim(),
    part_number: prod.part_number.toLowerCase(),
    price: prod.priceOpt,
    instock: prod.instock,
    id: prod.part_number,
    warranty: prod.warranty,
  }));

  const paginatedProducts = getPaginatedData(
    products,
    Number(limit),
    Number(page)
  );

  console.debug('📄 [fetchRizhska] returning:', {
    totalProducts: products.length,
    paginatedCount: paginatedProducts.length,
    page: Number(page),
    limit: Number(limit),
  });

  return {
    products: paginatedProducts,
    count: products.length,
  };
}
