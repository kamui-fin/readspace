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
  rankingScoreThreshold?: number; // Minimum relevance score (0-1), e.g. 0.68
}

/**
 * Default semantic ratio for hybrid search.
 * 0.5 is the optimal balanced hybrid setting: it delivers full semantic understanding
 * for natural language / intent queries while preventing exact named entity searches
 * (e.g. "Simon Willison", "Daring Fireball") from losing keyword precision.
 */
export const DEFAULT_SEMANTIC_RATIO = 0.5;

/**
 * Default ranking score threshold for hybrid search.
 * Filters out low-confidence hallucinations and nonsense queries while preserving relevant results.
 */
export const DEFAULT_RANKING_SCORE_THRESHOLD = 0.68;

/**
 * Create hybrid search parameters for AI-powered search.
 *
 * @param semanticRatio - Ratio of semantic vs keyword search (0-1), defaults to 0.5
 * @param rankingScoreThreshold - Minimum ranking score cutoff (0-1), defaults to 0.68
 * @returns Hybrid search configuration object
 *
 * @example
 * // Balanced hybrid search with optimal defaults (0.5 semantic ratio, 0.68 threshold)
 * const config = createHybridSearchParams();
 *
 * @example
 * // Custom semantic ratio and threshold
 * const config = createHybridSearchParams(0.5, 0.7);
 */
export function createHybridSearchParams(
  semanticRatio: number = DEFAULT_SEMANTIC_RATIO,
  rankingScoreThreshold: number = DEFAULT_RANKING_SCORE_THRESHOLD
): HybridSearchConfig {
  return {
    semanticRatio: Math.max(0, Math.min(1, semanticRatio)), // Clamp to [0, 1]
    embedder: 'default',
    rankingScoreThreshold: Math.max(0, Math.min(1, rankingScoreThreshold)),
  };
}
