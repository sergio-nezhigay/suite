import { AppConnections } from 'gadget-server';
import { findBestVariantWithEmbeddings } from '../ai/variantEmbeddings';

/**
 * Find the best matching product variant using AI embeddings
 * @param productTitle - The original product title to match
 * @param connections - Gadget app connections for OpenAI API
 * @returns The best matching variant title
 */
export const findBestVariant = async (
  productTitle: string,
  connections: AppConnections
): Promise<string> => {
  try {
    const result = await findBestVariantWithEmbeddings(productTitle, connections);
    return result.variant;
  } catch (error) {
    console.error('Error in findBestVariant:', error);
    // Return default on any error
    return 'Кабель USB консольний';
  }
};

/**
 * Find the best matching product variant with detailed results
 * @param productTitle - The original product title to match
 * @param connections - Gadget app connections for OpenAI API
 * @returns Object with variant, confidence score, and metadata
 */
export const findBestVariantDetailed = async (
  productTitle: string,
  connections: AppConnections
): Promise<{ variant: string; confidence: number }> => {
  try {
    return await findBestVariantWithEmbeddings(productTitle, connections);
  } catch (error) {
    console.error('Error in findBestVariantDetailed:', error);
    return {
      variant: 'Кабель USB консольний',
      confidence: 0,
    };
  }
};
