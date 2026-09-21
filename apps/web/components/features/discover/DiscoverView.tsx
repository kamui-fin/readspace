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

import { useCallback, useEffect, useMemo } from "react"
import { InstantSearch } from "react-instantsearch"

import { DiscoverContent } from "@/components/features/discover/DiscoverContent"
import { createDiscoverRouting } from "@/components/features/discover/lib/discover-router"
import { usePersistentState } from "@/hooks/use-persistent-state"
import { createSearchClient, FEEDS_INDEX_NAME } from "@/lib/meilisearch-client"

function getInitialAiState(): boolean {
    if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search)
        if (params.has("ai")) {
            return params.get("ai") === "1"
        }
    }
    return false
}

/**
 * Client-side discover page wrapper that sets up InstantSearch.
 *
 * Persists the search mode and keeps it in sync with the URL. DiscoverContent
 * applies that mode through Configure so it participates in search state.
 */
export default function DiscoverView() {
    const [aiSearchEnabled, setAiSearchEnabled] = usePersistentState(
        "discover-ai-search",
        getInitialAiState()
    )

    // Sync from URL if present on mount or popstate
    useEffect(() => {
        if (typeof window === "undefined") return
        const params = new URLSearchParams(window.location.search)
        if (params.has("ai")) {
            const isAi = params.get("ai") === "1"
            if (isAi !== aiSearchEnabled) {
                setAiSearchEnabled(isAi)
            }
        }
    }, [aiSearchEnabled, setAiSearchEnabled])

    useEffect(() => {
        const handlePopState = () => {
            const params = new URLSearchParams(window.location.search)
            if (params.has("ai")) {
                setAiSearchEnabled(params.get("ai") === "1")
            }
        }
        window.addEventListener("popstate", handlePopState)
        return () => window.removeEventListener("popstate", handlePopState)
    }, [setAiSearchEnabled])

    const handleAiSearchToggle = useCallback(
        (enabled: boolean) => {
            setAiSearchEnabled(enabled)
            if (typeof window !== "undefined") {
                const url = new URL(window.location.href)
                if (enabled) {
                    url.searchParams.set("ai", "1")
                } else {
                    url.searchParams.delete("ai")
                }
                window.history.replaceState(null, "", url.toString())
            }
        },
        [setAiSearchEnabled]
    )

    // Search mode is a Configure parameter, so InstantSearch owns request and
    // infinite-hit cache invalidation along with query/filter changes.
    const { searchClient } = useMemo(() => createSearchClient(), [])

    const routing = useMemo(() => createDiscoverRouting(), [])

    return (
        <InstantSearch
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            searchClient={searchClient as any}
            indexName={FEEDS_INDEX_NAME}
            routing={routing}
        >
            <DiscoverContent
                aiSearchEnabled={aiSearchEnabled}
                onAiSearchToggle={handleAiSearchToggle}
            />
        </InstantSearch>
    )
}
