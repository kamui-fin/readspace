import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import { getQueryClient } from "@/lib/get-query-client"
import { ArticlesSuspenseWrapper } from "@/components/articles/ArticlesSuspenseWrapper"
import { ApiClient, ArticlesPaginatedResponse } from "@readspace/shared"
import { RSS_QUERY_KEYS } from "@readspace/shared"
import { ensureServerApiClient } from "@/lib/server-api-client"

// Force dynamic rendering since we're fetching user-specific data
export const dynamic = "force-dynamic"

export default async function ArticlesPage() {
    // Ensure ApiClient is configured for server-side use
    await ensureServerApiClient()

    const queryClient = getQueryClient()

    // Prefetch infinite query parameters to match client-side useInfiniteArticles
    const infiniteQueryParams = {
        feedIds: undefined,
        folderId: undefined,
        publishedSince: undefined,
        publishedUntil: undefined,
        sortBy: "published_at",
        sortOrder: "desc",
        size: 25,
        viewType: "all",
        viewId: "all",
    }

    // Prefetch infinite articles data with the exact query key the component will use
    await queryClient.prefetchInfiniteQuery({
        queryKey: [RSS_QUERY_KEYS.ARTICLES, "infinite", infiniteQueryParams],
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
    })

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <ArticlesSuspenseWrapper
                showUnreadBadge={true}
                initialSidebarTitle="All Articles"
            />
        </HydrationBoundary>
    )
}
