import { useMemo } from "react"
import {
    useInfiniteArticles,
    useInfiniteReadLaterArticles,
    useInfiniteRecentlyReadArticles,
    useInfiniteTodayArticles,
} from "@readspace/shared"
import type { Article } from "@readspace/shared"

interface ArticlesPageData {
    items: Article[]
    next_cursor: string | null
    has_more: boolean
    total_count: number | null
}

interface UseArticlesDataProps {
    mode: "allArticles" | "recentlyRead" | "readLater" | "today"
    feedId?: string
    folderId?: string
    publishedSince?: string
    publishedUntil?: string
}

export function useArticlesData({
    mode,
    feedId,
    folderId,
    publishedSince,
    publishedUntil,
}: UseArticlesDataProps) {
    // Build query params
    const queryParams = useMemo(() => {
        const params: {
            feedId?: string
            folderId?: string
            limit?: number
            publishedSince?: string
            publishedUntil?: string
        } = {
            limit: 25,
            publishedSince,
            publishedUntil,
        }

        if (feedId) {
            params.feedId = feedId
        } else if (folderId) {
            params.folderId = folderId
        }

        return params
    }, [feedId, folderId, publishedSince, publishedUntil])

    // Use appropriate infinite query based on mode
    const todayQuery = useInfiniteTodayArticles({ limit: 25 }, {
        enabled: mode === "today",
    })

    const recentlyReadQuery = useInfiniteRecentlyReadArticles({ limit: 25 }, {
        enabled: mode === "recentlyRead",
    })

    const readLaterQuery = useInfiniteReadLaterArticles({ limit: 25 }, {
        enabled: mode === "readLater",
    })

    const allArticlesQuery = useInfiniteArticles(queryParams, {
        enabled:
            mode !== "today" && mode !== "recentlyRead" && mode !== "readLater",
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 30 * 60 * 1000, // 30 minutes
    })

    // Select the active query based on mode
    const activeQuery =
        mode === "today"
            ? todayQuery
            : mode === "recentlyRead"
                ? recentlyReadQuery
                : mode === "readLater"
                    ? readLaterQuery
                    : allArticlesQuery

    const {
        data,
        isLoading,
        isFetching,
        isFetchingNextPage,
        fetchNextPage,
        hasNextPage,
        refetch,
        error,
    } = activeQuery

    // Flatten paginated data into a single array
    const articles = useMemo(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const infiniteData = data as { pages: ArticlesPageData[]; pageParams: any[] }
        if (!infiniteData?.pages) return []
        return infiniteData.pages.flatMap(
            (page: ArticlesPageData) => page.items
        ) as Article[]
    }, [data])

    return {
        articles,
        isLoading,
        isFetching,
        isFetchingNextPage,
        fetchNextPage,
        hasNextPage,
        refetch,
        error,
        activeQuery, // Expose full query if needed
    }
}
