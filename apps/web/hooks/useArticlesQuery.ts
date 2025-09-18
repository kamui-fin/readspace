import {
    useInfiniteArticles,
    useInfiniteReadLaterArticles,
    useInfiniteRecentlyReadArticles,
    useInfiniteTodayArticles,
    type Article,
    type PaginatedResponse,
} from "@readspace/shared"
import { useMemo } from "react"

interface UseArticlesQueryParams {
    /** Current view mode */
    mode: "allArticles" | "readLater" | "recentlyRead" | "today"
    /** Feed ID for filtering */
    feedId?: string | null
    /** Folder ID for filtering */
    folderId?: string | null
    /** Published since date for filtering */
    publishedSince?: string | null
    /** Published until date for filtering */
    publishedUntil?: string | null
    /** Page size for pagination */
    pageSize?: number
}

interface UseArticlesQueryResult {
    /** Flattened array of all articles across pages */
    articles: Article[]
    /** Whether the initial load is in progress */
    isLoading: boolean
    /** Whether a fetch operation is in progress */
    isFetching: boolean
    /** Function to fetch the next page */
    fetchNextPage: () => void
    /** Whether there are more pages to load */
    hasNextPage: boolean | undefined
    /** Function to refetch all articles */
    refetch: () => void
    /** Any error that occurred during fetching */
    error: Error | null
}

/**
 * Custom hook to manage article queries based on different view modes.
 * Handles infinite scroll pagination and data transformation.
 */
export function useArticlesQuery({
    mode,
    feedId,
    folderId,
    publishedSince,
    publishedUntil,
    pageSize = 25,
}: UseArticlesQueryParams): UseArticlesQueryResult {
    // Common query options (using any to avoid type issues in shared package)
    const queryOptions: any = {
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        staleTime: 5 * 60 * 1000, // 5 minutes
    }

    // Prepare parameters for all articles query
    const allArticlesParams = useMemo(() => ({
        feedIds: feedId ? [feedId] : undefined,
        folderId: folderId || undefined,
        publishedSince: publishedSince || undefined,
        publishedUntil: publishedUntil || undefined,
        sortBy: "published_at" as const,
        sortOrder: "desc" as const,
        size: pageSize,
        viewType: folderId
            ? ("folder" as const)
            : feedId
                ? ("feed" as const)
                : ("all" as const),
        viewId: folderId || feedId || "all",
    }), [feedId, folderId, publishedSince, publishedUntil, pageSize])

    // Call all hooks at the top level (Rules of Hooks)
    const allArticlesQuery = useInfiniteArticles(
        allArticlesParams,
        { ...queryOptions, enabled: mode === "allArticles" }
    )

    const recentlyReadQuery = useInfiniteRecentlyReadArticles(
        { size: pageSize },
        { ...queryOptions, enabled: mode === "recentlyRead" }
    )

    const readLaterQuery = useInfiniteReadLaterArticles(
        { size: pageSize },
        { ...queryOptions, enabled: mode === "readLater" }
    )

    const todayQuery = useInfiniteTodayArticles(
        { size: pageSize },
        { ...queryOptions, enabled: mode === "today" }
    )

    // Select the appropriate query result based on mode
    const infiniteQuery = useMemo(() => {
        switch (mode) {
            case "recentlyRead":
                return recentlyReadQuery
            case "readLater":
                return readLaterQuery
            case "today":
                return todayQuery
            default: // "allArticles"
                return allArticlesQuery
        }
    }, [mode, allArticlesQuery, recentlyReadQuery, readLaterQuery, todayQuery])

    const {
        data,
        isLoading,
        isFetching,
        fetchNextPage,
        hasNextPage,
        refetch,
        error,
    } = infiniteQuery

    // Transform and flatten all pages of articles
    const articles = useMemo(() => {
        if (!data?.pages || !Array.isArray(data.pages)) return []

        const transformedArticles = data.pages
            .flatMap((page: unknown) => {
                const typedPage = page as PaginatedResponse<Article>
                // Handle different API response formats
                if (typedPage.items) {
                    return typedPage.items
                } else if (
                    "articles" in typedPage &&
                    Array.isArray((typedPage as any).articles)
                ) {
                    return (typedPage as any).articles.map(
                        (article: any): Article => ({
                            id: article.id || "",
                            feed_id: article.feed_id || "",
                            title: article.title || "",
                            link: article.link || article.url || "",
                            description: article.description || null,
                            content: article.content || null,
                            image_url: article.image_url || null,
                            author: article.author || null,
                            published_at: article.published_at || null,
                            is_read: article.is_read || false,
                            read_at: article.read_at || null,
                            is_read_later: article.is_read_later || false,
                            is_favorite: article.is_favorite || false,
                            created_at:
                                article.created_at || new Date().toISOString(),
                            updated_at:
                                article.updated_at || new Date().toISOString(),
                            user_id: article.user_id || "",
                            guid: article.guid || article.id || "",
                            estimated_read_time_minutes:
                                article.estimated_read_time_minutes || null,
                            custom_metadata: article.custom_metadata || null,
                            feed: article.feed || {
                                id: article.feed_id || null,
                                title: article.feed_title || null,
                                url: null,
                                image_url: article.feed_image_url || null,
                            },
                            article_type: article.article_type || "feed",
                            priority: article.priority || null,
                            note: article.note || null,
                        })
                    )
                }
                return []
            })
            .filter((article: Article) => article && article.id) // Filter out articles without an ID

        return transformedArticles
    }, [data])

    return {
        articles,
        isLoading,
        isFetching,
        fetchNextPage,
        hasNextPage,
        refetch,
        error: error as Error | null,
    }
}
