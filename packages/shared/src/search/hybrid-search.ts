/**
 * AI search configuration for hybrid search mode.
 *
 * Hybrid search combines keyword search with semantic vector search using embeddings.
 * Search engines like Meilisearch can automatically generate embeddings using AI models.
 *
 * Semantic Ratio Guide:
 * - 0.0: Pure keyword search (traditional)
 * - 0.3: Mostly keyword with some semantic understanding
 * - 0.5: Balanced hybrid (recommended for most use cases)
 * - 0.7: Mostly semantic with some keyword matching
 * - 1.0: Pure semantic search (best for finding similar content)
 */
export interface HybridSearchConfig {
  semanticRatio: number; // 0-1, where 0 = pure keyword, 1 = pure semantic
  embedder?: string; // Embedder name (defaults to "default")
}

/**
 * Create hybrid search parameters for AI-powered search.
 *
 * @param semanticRatio - Ratio of semantic vs keyword search (0-1)
 * @returns Hybrid search configuration object
 *
 * @example
 * // Balanced hybrid search
 * const config = createHybridSearchParams(0.5);
 *
 * @example
 * // More semantic for finding similar content
 * const config = createHybridSearchParams(0.8);
 */
export function createHybridSearchParams(
  semanticRatio: number = 1.0,
): HybridSearchConfig {
  return {
    semanticRatio: Math.max(0, Math.min(1, semanticRatio)), // Clamp to [0, 1]
    embedder: "default",
  };
}

/**
 * Default semantic ratio for hybrid search
 * Pure semantic (1.0) works best for natural language queries
 */
export const DEFAULT_SEMANTIC_RATIO = 1.0;
