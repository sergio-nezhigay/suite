import { BRANDED_PRICE_UAH, RECEIPT_CATALOG, type CatalogEntry } from './catalog';
import { classifyTitle } from './classify';

export type ReceiptLineInput = {
  title: string;
  price: number | string;
};

// FNV-1a: stable across runs, so the same order always gets the same names
export function stableHash(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function candidatePools(title: string, price: number): CatalogEntry[][] {
  const { category, form } = classifyTitle(title);
  const tier = price >= BRANDED_PRICE_UAH ? 'branded' : 'generic';
  const sameForm = RECEIPT_CATALOG.filter((e) => !form || e.form === form);
  const inCategory = sameForm.filter((e) => e.category === category);

  return [
    inCategory.filter((e) => e.tier === tier),
    inCategory,
    sameForm.filter((e) => e.tier === tier),
    sameForm,
  ].filter((pool) => pool.length > 0);
}

/**
 * Picks a check name for each line: same category and cable/adapter form as the
 * real product, branded names for expensive items, and no item (article)
 * repeated for different products within one check.
 */
export function assignReceiptNames(lines: ReceiptLineInput[], seed: string): string[] {
  const byTitle = new Map<string, string>();
  const usedArticles = new Set<string>();

  return lines.map(({ title, price }) => {
    const known = byTitle.get(title);
    if (known) return known;

    const pools = candidatePools(title, Number(price) || 0);
    const hash = stableHash(`${seed}|${title}`);
    const fresh = pools
      .map((pool) => pool.filter((e) => !usedArticles.has(e.article)))
      .find((pool) => pool.length > 0);
    // Every article already used: repeat rather than fail
    const pool = fresh ?? pools[0];
    const entry = pool[hash % pool.length];

    usedArticles.add(entry.article);
    byTitle.set(title, entry.name);
    return entry.name;
  });
}
