import { normalizeForMatch } from './normalize';
import type { NormalizedVariantProfile } from './profiles';

function splitTokens(text: string): string[] {
  return text.split(' ').filter(Boolean);
}

export function normalizedSimilarity(left: string, right: string): number {
  const leftTokens = splitTokens(left);
  const rightTokens = splitTokens(right);

  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return 0;
  }

  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);

  let shared = 0;
  leftSet.forEach((token) => {
    if (rightSet.has(token)) {
      shared++;
    }
  });

  return shared / Math.max(leftSet.size, rightSet.size);
}

export function levenshteinSimilarity(left: string, right: string): number {
  const a = normalizeForMatch(left);
  const b = normalizeForMatch(right);

  if (a.length === 0 || b.length === 0) {
    return 0;
  }

  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost
      );
    }

    for (let j = 0; j <= b.length; j++) {
      prev[j] = curr[j];
    }
  }

  const distance = prev[b.length];
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 0 : (maxLen - distance) / maxLen;
}

export function scoreProfile(normalizedInputTitle: string, profile: NormalizedVariantProfile): number {
  let bestScore = Math.max(
    normalizedSimilarity(normalizedInputTitle, profile.normalizedTitle),
    levenshteinSimilarity(normalizedInputTitle, profile.normalizedTitle)
  );

  for (const alias of profile.normalizedAliases) {
    bestScore = Math.max(
      bestScore,
      normalizedSimilarity(normalizedInputTitle, alias),
      levenshteinSimilarity(normalizedInputTitle, alias)
    );
  }

  const inputTokens = new Set(splitTokens(normalizedInputTitle));
  const keywordHits = profile.normalizedKeywords.filter((keyword) => inputTokens.has(keyword)).length;

  if (keywordHits > 0) {
    bestScore = Math.max(bestScore, Math.min(0.55 + keywordHits * 0.1, 0.95));
  }

  if (profile.normalizedAliases.some((alias) => alias && normalizedInputTitle.includes(alias))) {
    bestScore = Math.max(bestScore, 0.92);
  }

  return Math.min(bestScore, 1);
}

