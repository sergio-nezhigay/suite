import { AppConnections } from 'gadget-server';
import { createEmbedding } from './createEmbedding';

// Product variants with enhanced descriptions for better matching
const PRODUCT_VARIANTS = [
  {
    title: 'Кабель USB консольний',
    description: 'USB console cable для налагодження debugging роутер switch мережа network console port',
  },
  {
    title: 'Перехідник HDMI-RCA',
    description: 'HDMI to RCA adapter тюльпан AV composite video converter перехідник композитний',
  },
  {
    title: 'Кабель SCART',
    description: 'SCART cable скарт кабель телевізор TV connection видео аудио video audio',
  },
  {
    title: 'Перехідник SCART',
    description: 'SCART adapter скарт перехідник телевізор TV connector video audio converter',
  },
  {
    title: 'Перехідник USB-RS232',
    description: 'USB to RS232 adapter serial port COM port послідовний порт converter',
  },
  {
    title: 'Кабель USB-RS232, 1.5 м',
    description: 'USB to RS232 cable 1.5 meter serial COM port послідовний кабель converter short',
  },
  {
    title: 'Кабель USB-RS232 3 метри',
    description: 'USB to RS232 cable 3 meter long serial COM port послідовний кабель converter довгий',
  },
  {
    title: 'Перехідник HDMI-DP',
    description: 'HDMI to DisplayPort adapter DP connector монітор monitor display converter',
  },
  {
    title: 'Кабель USB Type C',
    description: 'USB Type-C cable USB-C connector modern smartphone tablet charging data transfer',
  },
  {
    title: 'Перехідник HDMI-VGA',
    description: 'HDMI to VGA adapter монітор старий monitor old display converter аналогвый analog',
  },
  {
    title: 'Термопаста, 2 гр.',
    description: 'Thermal paste термопаста процесор processor CPU cooling охлаждення теплопровідна compound',
  },
];

interface VariantEmbedding {
  title: string;
  embedding: number[];
  description: string;
}

// Cache for pre-computed embeddings
let variantEmbeddingsCache: VariantEmbedding[] | null = null;

/**
 * Generate and cache embeddings for all product variants
 */
export const generateVariantEmbeddings = async (connections: AppConnections): Promise<VariantEmbedding[]> => {
  if (variantEmbeddingsCache) {
    return variantEmbeddingsCache;
  }

  console.log('Generating embeddings for product variants...');

  try {
    const variantEmbeddings: VariantEmbedding[] = [];

    for (const variant of PRODUCT_VARIANTS) {
      // Combine title and description for richer semantic understanding
      const textForEmbedding = `${variant.title} ${variant.description}`;
      const embedding = await createEmbedding(connections, textForEmbedding);

      variantEmbeddings.push({
        title: variant.title,
        embedding,
        description: variant.description,
      });

      console.log(`Generated embedding for: ${variant.title}`);
    }

    variantEmbeddingsCache = variantEmbeddings;
    console.log(`Successfully cached ${variantEmbeddings.length} variant embeddings`);

    return variantEmbeddings;
  } catch (error) {
    console.error('Error generating variant embeddings:', error);
    throw error;
  }
};

/**
 * Calculate cosine similarity between two vectors
 */
export const calculateCosineSimilarity = (vecA: number[], vecB: number[]): number => {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
};

/**
 * Find the best matching variant using embeddings
 */
export const findBestVariantWithEmbeddings = async (
  productTitle: string,
  connections: AppConnections,
  confidenceThreshold: number = 0.3
): Promise<{ variant: string; confidence: number }> => {
  try {
    // Generate input embedding
    const inputEmbedding = await createEmbedding(connections, productTitle);

    // Get cached variant embeddings
    const variantEmbeddings = await generateVariantEmbeddings(connections);

    // Find best match using cosine similarity
    let bestMatch = variantEmbeddings[0];
    let bestScore = 0;

    for (const variant of variantEmbeddings) {
      const similarity = calculateCosineSimilarity(inputEmbedding, variant.embedding);

      if (similarity > bestScore) {
        bestScore = similarity;
        bestMatch = variant;
      }
    }

    // If confidence is too low, return default
    if (bestScore < confidenceThreshold) {
      console.log(`Low confidence match: "${productTitle}" -> using default (confidence: ${bestScore.toFixed(3)})`);
      return {
        variant: 'Кабель USB консольний', // Default fallback
        confidence: bestScore,
      };
    }

    console.log(`Embedding match: "${productTitle}" -> "${bestMatch.title}" (confidence: ${bestScore.toFixed(3)})`);

    return {
      variant: bestMatch.title,
      confidence: bestScore,
    };
  } catch (error) {
    console.error('Error in embedding-based variant matching:', error);
    // Return default on error
    return {
      variant: 'Кабель USB консольний',
      confidence: 0,
    };
  }
};

/**
 * Clear the embeddings cache (useful for testing or updates)
 */
export const clearVariantEmbeddingsCache = (): void => {
  variantEmbeddingsCache = null;
  console.log('Variant embeddings cache cleared');
};