import { ArticlesSuspenseWrapper } from "@/components/articles/ArticlesSuspenseWrapper"
import "@/lib/configure-api-client"
import { getQueryClient } from "@/lib/get-query-client"
import {
    ApiClient,
    ArticlesPaginatedResponse,
    Feed,
    RSS_QUERY_KEYS,
} from "@readspace/shared"
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"

// Force dynamic rendering since we're fetching user-specific data
export const dynamic = "force-dynamic"

interface PageProps {
    params: Promise<{ id: string }>
    searchParams: Promise<{ preview?: string }>
}

export default async function FeedArticlesPage({
    params,
    searchParams,
}: PageProps) {
    const resolvedParams = await params
    const feedId = resolvedParams.id
    const resolvedSearchParams = await searchParams
    const isPreview = resolvedSearchParams.preview === "true"

    const queryClient = getQueryClient()

    let feed: Feed
    if (isPreview) {
        // For preview mode, refresh the feed first to get latest articles
        try {
            feed = await ApiClient.rss.refreshFeed(feedId, true, true)
        } catch {
            // If preview refresh fails, try to get basic feed info
            feed = await ApiClient.rss.getFeed(feedId)
        }
    } else {
        // Normal mode - just get the feed data
        feed = await ApiClient.rss.getFeed(feedId)
    }

    if (!feed) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <div className="text-center">
                    <p className="text-lg font-medium">Feed not found</p>
                    <p className="text-muted-foreground">
                        {isPreview
                            ? "The feed you're trying to preview doesn't exist or couldn't be refreshed."
                            : "The feed you're looking for doesn't exist or has been removed."}
                    </p>
                </div>
            </div>
        )
    }

    // Prefetch infinite query parameters to match client-side useInfiniteArticles
    const infiniteQueryParams = {
        feedIds: [feedId],
        folderId: undefined,
        publishedSince: undefined,
        publishedUntil: undefined,
        sortBy: "published_at",
        sortOrder: "desc",
        size: 25,
        viewType: "feed",
        viewId: feedId,
    }

    // Prefetch only the essential data needed for immediate page render
    await Promise.all([
        queryClient.prefetchQuery({
            queryKey: [RSS_QUERY_KEYS.FEEDS, feedId],
            queryFn: () => feed,
            staleTime: 5 * 60 * 1000,
        }),
        queryClient.prefetchInfiniteQuery({
            queryKey: [
                RSS_QUERY_KEYS.ARTICLES,
                "infinite",
                infiniteQueryParams,
            ],
            queryFn: ({ pageParam = 1 }) =>
                ApiClient.rss.getArticles({
                    feed_ids: infiniteQueryParams.feedIds,
                    folder_id: infiniteQueryParams.folderId,
                    published_since: infiniteQueryParams.publishedSince,
                    published_until: infiniteQueryParams.publishedUntil,
                    sort_by: infiniteQueryParams.sortBy,
                    sort_order: infiniteQueryParams.sortOrder,
                    page: pageParam,
                    size: infiniteQueryParams.size,
                }),
            initialPageParam: 1,
            getNextPageParam: (lastPage: ArticlesPaginatedResponse) => {
                const currentPage = lastPage.page || 1
                const totalPages = lastPage.pages || 1
                return currentPage < totalPages ? currentPage + 1 : undefined
            },
            staleTime: 5 * 60 * 1000, // 5 minutes to match client
        }),
    ])

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <ArticlesSuspenseWrapper
                showUnreadBadge={!isPreview}
                feedId={feedId}
                initialSidebarTitle={feed.title || "Unknown Feed"}
            />
        </HydrationBoundary>
    )
}
