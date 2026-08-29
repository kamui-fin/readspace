"use client"

/**
 * Discover Page Client - Meilisearch Edition
 *
 * This component uses React InstantSearch for direct browser-based search
 * via Meilisearch, replacing the previous backend API approach.
 *
 * Key features:
 * - Direct Meilisearch integration (no backend proxy)
 * - Category and language filtering
 * - Real-time search with typo tolerance
 * - Pagination support
 */

import { useMemo } from "react"
import { InstantSearch } from "react-instantsearch"

import { DiscoverContent } from "@/components/features/discover/DiscoverContent"
import { createSearchClient, FEEDS_INDEX_NAME } from "@/lib/meilisearch-client"

/**
 * Client-side discover page wrapper that sets up InstantSearch.
 */
export default function DiscoverView() {
    // Create the search client once.
    const { searchClient } = useMemo(() => createSearchClient(), [])

    return (
        <InstantSearch
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            searchClient={searchClient as any}
            indexName={FEEDS_INDEX_NAME}
        >
            <DiscoverContent />
        </InstantSearch>
    )
}
