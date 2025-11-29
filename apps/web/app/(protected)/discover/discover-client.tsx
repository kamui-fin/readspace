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

import { useEffect, useMemo, useRef, useState } from "react"
import { InstantSearch } from "react-instantsearch"

import { DiscoverContent } from "@/components/features/discover/DiscoverContent"
import {
    createHybridSearchParams,
    createSearchClient,
    FEEDS_INDEX_NAME,
} from "@/lib/meilisearch-client"

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
export default function DiscoverPageClient({
    initialLanguage,
}: DiscoverPageClientProps) {
    // AI search state - defaults to disabled
    const [aiSearchEnabled, setAiSearchEnabled] = useState("false")

    // Use ref to allow search client to access current AI state without recreating
    const aiSearchEnabledRef = useRef(aiSearchEnabled)

    useEffect(() => {
        aiSearchEnabledRef.current = aiSearchEnabled
    }, [aiSearchEnabled])

    useEffect(() => {
        if (typeof window !== "undefined") {
            try {
                const aiEnabled =
                    localStorage.getItem("discover-ai-search") || "false"
                setAiSearchEnabled(aiEnabled)
            } catch (error) {
                console.error("Error reading AI search settings:", error)
            }
        }
    }, [])

    // Create search client once with a function that dynamically checks AI state
    const { searchClient } = useMemo(() => {
        return createSearchClient(() => {
            return aiSearchEnabledRef.current === "true"
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
                onAiSettingsChange={(enabled) => {
                    setAiSearchEnabled(enabled ? "true" : "false")
                }}
            />
        </InstantSearch>
    )
}
