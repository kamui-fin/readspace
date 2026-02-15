"use client"

/**
 * Discover Page Client - Meilisearch Edition
 *
 * This component uses React InstantSearch for direct browser-based search
 * via Meilisearch, replacing the previous backend API approach.
 *
 * Key features:
 * - Direct Meilisearch integration (no backend proxy)
 * - AI-powered hybrid search with semantic ratio control
 * - Category and language filtering
 * - Real-time search with typo tolerance
 * - Pagination support
 */

import { useEffect, useMemo, useRef } from "react"
import { InstantSearch } from "react-instantsearch"

import { DiscoverContent } from "@/components/features/discover/DiscoverContent"
import {
    createHybridSearchParams,
    createSearchClient,
    FEEDS_INDEX_NAME,
} from "@/lib/meilisearch-client"
import { usePersistentState } from "@/hooks/use-persistent-state"

interface DiscoverPageClientProps {
    /** Initial language preference from URL params */
    initialLanguage?: string
}

/**
 * Client-side discover page wrapper that sets up InstantSearch.
 *
 * This component:
 * - Creates a stable search client with dynamic AI search toggle
 * - Manages AI search state via localStorage
 * - Provides the search client to child components via InstantSearch context
 */
export default function DiscoverView({
    initialLanguage,
}: DiscoverPageClientProps) {
    // AI search state - defaults to disabled, persisted in localStorage
    const [aiSearchEnabled, setAiSearchEnabled] = usePersistentState(
        "discover-ai-search",
        false
    )

    // Use ref to allow search client to access current AI state without recreating
    const aiSearchEnabledRef = useRef(aiSearchEnabled)

    useEffect(() => {
        aiSearchEnabledRef.current = aiSearchEnabled
    }, [aiSearchEnabled])

    // Create search client once with a function that dynamically checks AI state
    const { searchClient } = useMemo(() => {
        return createSearchClient(() => {
            return aiSearchEnabledRef.current
                ? createHybridSearchParams()
                : undefined
        })
    }, []) // Only create once, never recreate

    return (
        <InstantSearch
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            searchClient={searchClient as any}
            indexName={FEEDS_INDEX_NAME}
        >
            <DiscoverContent
                initialLanguage={initialLanguage}
                onAiSettingsChange={setAiSearchEnabled}
            />
        </InstantSearch>
    )
}
