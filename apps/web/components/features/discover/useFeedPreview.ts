import { useQuery } from "@tanstack/react-query"
import { ApiClient, type FeedDiscoveryResult } from "@readspace/shared"
import { useMemo } from "react"

/**
 * Detect if a string is a URL pattern (http://, https://, rsshub://)
 */
function isUrl(str: string): boolean {
    const urlPattern = /^(https?:\/\/|rsshub:\/\/)/i
    return urlPattern.test(str.trim())
}

interface UseFeedPreviewResult {
    /** The preview feed data if URL is detected and fetch succeeds */
    previewFeed: FeedDiscoveryResult | null
    /** Whether the preview is currently loading */
    isLoading: boolean
    /** Error message if preview fetch fails */
    error: string | null
    /** Whether the query is a URL */
    isUrlQuery: boolean
    /** Whether the query has failed */
    isError: boolean
}

/**
 * Hook for detecting URLs in search queries and fetching feed previews.
 *
 * When a user pastes an RSS feed URL into the search box, this hook:
 * 1. Detects if the query is a URL pattern
 * 2. Fetches feed metadata from the backend preview endpoint
 * 3. Returns the preview data for display
 */
export function useFeedPreview(query: string): UseFeedPreviewResult {
    const isUrlQuery = useMemo(() => isUrl(query), [query])
    const trimmedQuery = query.trim()

    const {
        data: previewFeed,
        isLoading,
        error,
        isError,
    } = useQuery({
        queryKey: ["feedPreview", trimmedQuery],
        queryFn: async () => {
            const response = await ApiClient.previewFeed(trimmedQuery)
            return response
        },
        enabled: isUrlQuery && trimmedQuery.length > 0,
        retry: false,
        staleTime: 5 * 60 * 1000, // 5 minutes
    })

    const errorMessage = useMemo(() => {
        if (!error) return null

        let message = "Could not fetch feed preview"
        if (error && typeof error === "object" && "response" in error) {
            const response = (
                error as { response?: { data?: { detail?: string } } }
            ).response
            if (response?.data?.detail) {
                message = response.data.detail
            }
        }
        return message
    }, [error])

    return {
        previewFeed: previewFeed ?? null,
        isLoading,
        error: errorMessage,
        isUrlQuery,
        isError,
    }
}
