import { normalizeForMatch } from './normalize';
import { DEFAULT_VARIANT, LOW_CONFIDENCE_THRESHOLD, NORMALIZED_VARIANT_PROFILES } from './profiles';
import { resolveRuleBasedMatch } from './rules';
import { scoreProfile } from './scoring';
import type { BestVariantMatch } from './types';

export const resolveBestVariant = (productTitle: string): BestVariantMatch => {
  const rawTitle = productTitle.toLowerCase().trim();
  const normalizedTitle = normalizeForMatch(productTitle);

  if (!normalizedTitle) {
    return { variant: DEFAULT_VARIANT, confidence: 0 };
  }

  const ruleMatch = resolveRuleBasedMatch(rawTitle, normalizedTitle);
  if (ruleMatch) {
    return ruleMatch;
  }

  let bestMatch: BestVariantMatch = {
    variant: DEFAULT_VARIANT,
    confidence: 0,
  };

  for (const profile of NORMALIZED_VARIANT_PROFILES) {
    const confidence = scoreProfile(normalizedTitle, profile);

    if (confidence > bestMatch.confidence) {
      bestMatch = {
        variant: profile.title,
        confidence,
      };
    }
  }

  if (bestMatch.confidence < LOW_CONFIDENCE_THRESHOLD) {
    return {
      variant: DEFAULT_VARIANT,
      confidence: bestMatch.confidence,
    };
  }

  return bestMatch;
};

