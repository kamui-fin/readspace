import { getQueryClient } from "@/lib/get-query-client"
import { ArticlesSuspenseWrapper } from "@/components/articles/articles-suspense-wrapper"
import { ServerApiClient } from "@/lib/api/server"
import { RSS_QUERY_KEYS } from "@/lib/query-keys"
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"

// Force dynamic rendering since we're fetching user-specific data
export const dynamic = 'force-dynamic'

export default async function TodayPage() {
    const now = new Date()
    // Set to start of today in UTC
    const startOfDay = new Date(now)
    startOfDay.setUTCHours(0, 0, 0, 0)
    
    // Set to end of today in UTC (23:59:59.999)
    const endOfDay = new Date(now)
    endOfDay.setUTCHours(23, 59, 59, 999)

    const publishedSince = startOfDay.toISOString()
    const publishedUntil = endOfDay.toISOString()

    const queryClient = getQueryClient()

    // Prefetch today's articles with date filtering
    await queryClient.prefetchQuery({
        queryKey: [RSS_QUERY_KEYS.ARTICLES, {
            feedIds: undefined,
            folderId: undefined,
            publishedSince,
            publishedUntil,
            page: 1,
            size: 25,
            sortBy: "published_at",
            sortOrder: "desc",
            viewType: 'all',
            viewId: 'all',
        }],
        queryFn: () => ServerApiClient.getArticlesData({
            mode: "allArticles",
            publishedSince,
            publishedUntil
        }),
    })

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <ArticlesSuspenseWrapper
                title="Today"
                showUnreadBadge={true}
                initialSidebarTitle="Today"
                publishedSince={publishedSince}
                publishedUntil={publishedUntil}
            />
        </HydrationBoundary>
    )
}
