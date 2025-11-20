import { ApiClient, type FeedDiscoveryResult } from "@readspace/shared"
import { useEffect, useState } from "react"

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
    const [previewFeed, setPreviewFeed] = useState<FeedDiscoveryResult | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const isUrlQuery = isUrl(query)

    useEffect(() => {
        // Reset state when query changes
        if (!query || !isUrlQuery) {
            setPreviewFeed(null)
            setError(null)
            setIsLoading(false)
            return
        }

        // Debounce URL fetching to avoid excessive requests
        const timeoutId = setTimeout(async () => {
            setIsLoading(true)
            setError(null)

            try {
                const response = await ApiClient.get<FeedDiscoveryResult>(
                    `/api/discover/preview?url=${encodeURIComponent(query.trim())}`
                )

                setPreviewFeed(response)
            } catch (err: unknown) {
                console.error("Failed to fetch feed preview:", err)
                let errorMessage = "Could not fetch feed preview"

                if (err && typeof err === "object" && "response" in err) {
                    const response = (err as { response?: { data?: { detail?: string } } }).response
                    if (response?.data?.detail) {
                        errorMessage = response.data.detail
                    }
                }

                setError(errorMessage)
                setPreviewFeed(null)
            } finally {
                setIsLoading(false)
            }
        }, 500) // 500ms debounce

        return () => clearTimeout(timeoutId)
    }, [query, isUrlQuery])

    return {
        previewFeed,
        isLoading,
        error,
        isUrlQuery,
    }
}
