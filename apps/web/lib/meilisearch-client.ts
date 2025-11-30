/**
 * Meilisearch client configuration for feed search.
 *
 * This module sets up the Meilisearch InstantSearch client for direct
 * browser-based search without going through the backend API.
 */

import { instantMeiliSearch } from "@meilisearch/instant-meilisearch"
import { MeiliSearch } from "meilisearch"
import type { HybridSearchConfig } from "@readspace/shared"

// ============================================================================
// Environment Configuration
// ============================================================================

export const MEILISEARCH_URL =
    process.env.NEXT_PUBLIC_MEILISEARCH_URL || "http://localhost:7700"
export const MEILISEARCH_SEARCH_KEY =
    process.env.NEXT_PUBLIC_MEILISEARCH_SEARCH_KEY || ""

if (!MEILISEARCH_SEARCH_KEY) {
    console.warn(
        "NEXT_PUBLIC_MEILISEARCH_SEARCH_KEY is not set. Search functionality may not work correctly."
    )
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Index name for feed search.
 */
export const FEEDS_INDEX_NAME = "feeds"

/**
 * Default search configuration.
 */
export const DEFAULT_SEARCH_CONFIG = {
    hitsPerPage: 20, // Results per page
    attributesToHighlight: ["title", "description"], // Fields to highlight in results
    highlightPreTag: "<mark>", // HTML tag for highlighting
    highlightPostTag: "</mark>",
}

// ============================================================================
// Type Definitions
// ============================================================================

interface SearchRequest {
    params?: SearchParams
}

interface SearchParams {
    query?: string
    q?: string
    facetFilters?: Array<string | string[]>
    filter?: Array<string | string[]>
    hybrid?: {
        semanticRatio: number
        embedder?: string
    }
    showRankingScore?: boolean
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a search request has a meaningful query string.
 */
function hasQuery(params?: SearchParams): boolean {
    if (!params) return false
    return (
        (!!params.query && params.query.trim() !== "") ||
        (!!params.q && params.q.trim() !== "")
    )
}

/**
 * Check if a filter array contains category filters.
 */
function hasCategoryFilter(filters: Array<string | string[]>): boolean {
    return filters.some((filter) => {
        if (typeof filter === "string") {
            return (
                filter.startsWith("top_level_category:") ||
                filter.includes("top_level_category")
            )
        }
        if (Array.isArray(filter)) {
            return filter.some(
                (f: string) =>
                    typeof f === "string" &&
                    (f.startsWith("top_level_category:") ||
                        f.includes("top_level_category"))
            )
        }
        return false
    })
}

/**
 * Check if a search request has meaningful search criteria.
 * A request is meaningful if it has:
 * - A query string, OR
 * - A category filter (language-only filters are not enough)
 */
function hasMeaningfulCriteria(params?: SearchParams): boolean {
    // Check for query
    if (hasQuery(params)) {
        return true
    }

    if (!params) return false

    // Check facetFilters for category
    if (params.facetFilters && Array.isArray(params.facetFilters)) {
        if (hasCategoryFilter(params.facetFilters)) {
            return true
        }
    }

    // Check regular filter field for category
    if (params.filter && Array.isArray(params.filter)) {
        if (hasCategoryFilter(params.filter)) {
            return true
        }
    }

    return false
}

/**
 * Apply hybrid search parameters to a search request.
 */
function applyHybridSearchParams(
    request: SearchRequest,
    hybridConfig: HybridSearchConfig
): SearchRequest {
    return {
        ...request,
        params: {
            ...request.params,
            hybrid: {
                semanticRatio: hybridConfig.semanticRatio,
                embedder: hybridConfig.embedder || "default",
            },
            showRankingScore: true,
        },
    }
}

/**
 * Create an empty search result.
 */
function createEmptyResult() {
    return {
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
    }
}

// ============================================================================
// Main Export: Search Client
// ============================================================================

/**
 * Create a search client with dynamic hybrid search support.
 *
 * @param getHybridConfig - Function that returns current hybrid config (allows dynamic toggling)
 * @returns InstantSearch client with searchClient
 */
export function createSearchClient(
    getHybridConfig?: () => HybridSearchConfig | undefined
) {
    const config: Record<string, unknown> = {
        primaryKey: "id",
        placeholderSearch: true,
        keepZeroFacets: true,
        finitePagination: true,
    }

    const baseClient = instantMeiliSearch(
        MEILISEARCH_URL,
        MEILISEARCH_SEARCH_KEY,
        config
    )

    // Create a proxy to prevent searches with no query AND no category filter
    // AND to dynamically inject hybrid search params
    return {
        ...baseClient,
        searchClient: {
            ...baseClient.searchClient,
            search(requests: SearchRequest[]) {
                // Apply hybrid search params dynamically if enabled
                const hybridConfig = getHybridConfig?.()
                let processedRequests = requests

                if (hybridConfig) {
                    processedRequests = requests.map((request) =>
                        applyHybridSearchParams(request, hybridConfig)
                    )
                }

                // Check if at least ONE request has meaningful search criteria
                const hasAnyMeaningfulSearch = processedRequests.some(
                    ({ params }) => hasMeaningfulCriteria(params)
                )

                // Skip search only if NO request has meaningful criteria
                if (!hasAnyMeaningfulSearch) {
                    // Return empty results without making a request
                    return Promise.resolve({
                        results: requests.map(() => createEmptyResult()),
                    })
                }

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return baseClient.searchClient.search(processedRequests as any)
            },
        },
    }
}

/**
 * Default search client without hybrid search.
 * Use createSearchClient() with hybrid config for AI-powered search.
 */
export const { searchClient } = createSearchClient()

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
})

// Re-export hybrid search utilities from shared package
export {
    createHybridSearchParams,
    type HybridSearchConfig,
} from "@readspace/shared"
