import { useMemo } from "react"
import {
    useInfiniteArticles,
    useInfiniteReadLaterArticles,
    useInfiniteRecentlyReadArticles,
    useInfiniteTodayArticles,
    ArticleFilterMode,
} from "@readspace/shared"
import type { Article } from "@readspace/shared"

interface ArticlesPageData {
    items: Article[]
    next_cursor: string | null
    has_more: boolean
    total_count: number | null
}

interface UseArticlesDataProps {
    mode: ArticleFilterMode
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
    const todayQuery = useInfiniteTodayArticles(
        { limit: 25 },
        {
            enabled: mode === ArticleFilterMode.Today,
        }
    )

    const recentlyReadQuery = useInfiniteRecentlyReadArticles(
        { limit: 25 },
        {
            enabled: mode === ArticleFilterMode.RecentlyRead,
        }
    )

    const readLaterQuery = useInfiniteReadLaterArticles(
        { limit: 25 },
        {
            enabled: mode === ArticleFilterMode.ReadLater,
        }
    )

    const allArticlesQuery = useInfiniteArticles(queryParams, {
        enabled:
            mode !== ArticleFilterMode.Today &&
            mode !== ArticleFilterMode.RecentlyRead &&
            mode !== ArticleFilterMode.ReadLater,
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 30 * 60 * 1000, // 30 minutes
    })

    // Select the active query based on mode
    const activeQuery =
        mode === ArticleFilterMode.Today
            ? todayQuery
            : mode === ArticleFilterMode.RecentlyRead
                ? recentlyReadQuery
                : mode === ArticleFilterMode.ReadLater
                    ? readLaterQuery
                    : allArticlesQuery

    const { data } = activeQuery

    // Flatten paginated data into a single array
    const articles = useMemo(() => {
        const infiniteData = data as {
            pages: ArticlesPageData[]
            pageParams: unknown[]
        }
        if (!infiniteData?.pages) return []
        return infiniteData.pages.flatMap(
            (page: ArticlesPageData) => page.items
        ) as Article[]
    }, [data])

    return {
        query: activeQuery,
        // Helper to get flattened articles, but components can also do this
        articles,
    }
}
