export type { BestVariantMatch } from './findBestVariant/types';
export { resolveBestVariant } from './findBestVariant/resolver';

import { resolveBestVariant as resolveBestVariantImpl } from './findBestVariant/resolver';
import type { BestVariantMatch } from './findBestVariant/types';

export const findBestVariant = async (productTitle: string): Promise<string> => {
  return resolveBestVariantImpl(productTitle).variant;
};

export const findBestVariantDetailed = async (
  productTitle: string
): Promise<BestVariantMatch> => {
  return resolveBestVariantImpl(productTitle);
};
