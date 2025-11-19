/**
 * Meilisearch client configuration for feed search.
 *
 * This module sets up the Meilisearch InstantSearch client for direct
 * browser-based search without going through the backend API.
 */

import { instantMeiliSearch } from "@meilisearch/instant-meilisearch";
import { MeiliSearch } from "meilisearch";
import type { HybridSearchConfig } from "@readspace/shared";

// Environment variables for Meilisearch configuration
export const MEILISEARCH_URL =
  process.env.NEXT_PUBLIC_MEILISEARCH_URL || "http://localhost:7700";
export const MEILISEARCH_SEARCH_KEY =
  process.env.NEXT_PUBLIC_MEILISEARCH_SEARCH_KEY || "";

if (!MEILISEARCH_SEARCH_KEY) {
  console.warn(
    "NEXT_PUBLIC_MEILISEARCH_SEARCH_KEY is not set. Search functionality may not work correctly."
  );
}

/**
 * Create a search client with dynamic hybrid search support.
 *
 * @param getHybridConfig - Function that returns current hybrid config (allows dynamic toggling)
 * @returns InstantSearch client with searchClient
 */
export function createSearchClient(getHybridConfig?: () => HybridSearchConfig | undefined) {
  const config: any = {
    primaryKey: "id",
    placeholderSearch: true,
    keepZeroFacets: true,
    finitePagination: true,
  };

  const baseClient = instantMeiliSearch(MEILISEARCH_URL, MEILISEARCH_SEARCH_KEY, config);

  // Create a proxy to prevent searches with no query AND no category filter
  // AND to dynamically inject hybrid search params
  return {
    ...baseClient,
    searchClient: {
      ...baseClient.searchClient,
      search(requests: any[]) {
        // Apply hybrid search params dynamically if enabled
        const hybridConfig = getHybridConfig?.();
        if (hybridConfig) {
          requests = requests.map((request) => ({
            ...request,
            params: {
              ...request.params,
              hybrid: {
                semanticRatio: hybridConfig.semanticRatio,
                embedder: hybridConfig.embedder || "default",
              },
              showRankingScore: true,
            },
          }));
        }

        // Check if at least ONE request has meaningful search criteria
        const hasAnyMeaningfulSearch = requests.some(({ params }) => {
          // Check both 'query' and 'q' fields (Meilisearch uses 'query')
          const hasQuery = (params?.query && params.query.trim() !== '') ||
                          (params?.q && params.q.trim() !== '');

          // If any request has a query, allow all searches
          if (hasQuery) {
            return true;
          }

          // Check for category filter specifically (not language-only)
          if (params?.facetFilters && Array.isArray(params.facetFilters)) {
            const hasCategoryFilter = params.facetFilters.some((filter: any) => {
              if (typeof filter === 'string') {
                return filter.startsWith('top_level_category:');
              }
              if (Array.isArray(filter)) {
                return filter.some((f: string) => f.startsWith('top_level_category:'));
              }
              return false;
            });

            if (hasCategoryFilter) {
              return true;
            }
          }

          // Also check regular filter field (Meilisearch uses this)
          if (params?.filter && Array.isArray(params.filter)) {
            const hasCategoryInFilter = params.filter.some((filterGroup: any) => {
              if (Array.isArray(filterGroup)) {
                return filterGroup.some((f: string) =>
                  typeof f === 'string' && f.includes('top_level_category')
                );
              }
              return typeof filterGroup === 'string' && filterGroup.includes('top_level_category');
            });

            if (hasCategoryInFilter) {
              return true;
            }
          }

          return false;
        });

        // Skip search only if NO request has meaningful criteria
        if (!hasAnyMeaningfulSearch) {
          // Return empty results without making a request
          return Promise.resolve({
            results: requests.map(() => ({
              hits: [],
              nbHits: 0,
              nbPages: 0,
              page: 0,
              processingTimeMS: 0,
              hitsPerPage: 0,
              exhaustiveNbHits: false,
              query: "",
              params: "",
              facets: {},
            })),
          });
        }

        return baseClient.searchClient.search(requests as any);
      },
    },
  };
}

/**
 * Default search client without hybrid search.
 * Use createSearchClient() with hybrid config for AI-powered search.
 */
export const { searchClient } = createSearchClient();

/**
 * Direct Meilisearch client for advanced operations like similar documents.
 * 
 * Use this for operations not supported by InstantSearch, such as:
 * - Similar document search
 * - Direct document retrieval
 * - Custom queries
 */
export const meilisearchClient = new MeiliSearch({
  host: MEILISEARCH_URL,
  apiKey: MEILISEARCH_SEARCH_KEY,
});

/**
 * Index name for feed search.
 */
export const FEEDS_INDEX_NAME = "feeds";

/**
 * Default search configuration.
 */
export const DEFAULT_SEARCH_CONFIG = {
  hitsPerPage: 20, // Results per page
  attributesToHighlight: ["title", "description"], // Fields to highlight in results
  highlightPreTag: "<mark>", // HTML tag for highlighting
  highlightPostTag: "</mark>",
};

// Re-export hybrid search utilities from shared package
export { createHybridSearchParams, type HybridSearchConfig } from "@readspace/shared";