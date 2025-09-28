// Product variants list
const productVariants = [
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

// Simple string similarity function using Levenshtein distance
const calculateSimilarity = (str1: string, str2: string): number => {
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
};

/**
 * Find the best matching product variant with semantic understanding
 * @param productTitle - The original product title to match
 * @returns The best matching variant or the original title if no good match found
 */
export const findBestVariant = (productTitle: string): string => {
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
      match: title.includes('3') || title.includes('три') ? 'Кабель USB-RS232 3 метри' : 'Кабель USB-RS232 1.5m'
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
  let bestMatch = productVariants[0];
  let bestScore = 0;

  for (const variant of productVariants) {
    const score = calculateSimilarity(productTitle, variant);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = variant;
    }
  }

  console.log(`Similarity fallback: "${productTitle}" -> "${bestMatch}" (score: ${bestScore})`);
  return bestMatch;
};