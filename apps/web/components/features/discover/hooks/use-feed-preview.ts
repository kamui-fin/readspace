import { type FeedDiscoveryResult, usePreviewFeedUrl } from "@readspace/shared"
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
    } = usePreviewFeedUrl(trimmedQuery, {
        enabled: isUrlQuery && trimmedQuery.length > 0,
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

    const enrichedPreviewFeed = useMemo(() => {
        if (!previewFeed) return null
        return {
            ...previewFeed,
            // Ensure URL is present, falling back to the query if the API response is missing it
            url: previewFeed.url || trimmedQuery,
        }
    }, [previewFeed, trimmedQuery])

    return {
        previewFeed: enrichedPreviewFeed,
        isLoading,
        error: errorMessage,
        isUrlQuery,
        isError,
    }
}
