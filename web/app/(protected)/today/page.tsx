import { getQueryClient } from "@/lib/get-query-client"
import { ArticlesView } from "@/components/articles"
import { ServerApiClient } from "@/lib/api/server"
import { RSS_QUERY_KEYS } from "@/lib/query-keys"
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"

// Force dynamic rendering since we're fetching user-specific data
export const dynamic = 'force-dynamic'

export default async function TodayPage() {
    const today = new Date()
    const startOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
    )
    const endOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + 1
    )

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
            <ArticlesView
                initialSidebarTitle="Today"
                publishedSince={publishedSince}
                publishedUntil={publishedUntil}
            />
        </HydrationBoundary>
    )
}
