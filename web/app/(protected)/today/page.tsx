import { getQueryClient } from "@/lib/get-query-client"
import { ArticlesSuspenseWrapper } from "@/components/articles/articles-suspense-wrapper"
import { ServerApiClient } from "@/lib/api/server"
import { RSS_QUERY_KEYS } from "@/lib/query-keys"
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"

// Force dynamic rendering since we're fetching user-specific data
export const dynamic = 'force-dynamic'

export default async function TodayPage() {
    const queryClient = getQueryClient()

    // Note: Timezone detection is now handled client-side in ArticlesView component
    // to ensure we get the user's actual timezone instead of the server's timezone

    // Prefetch today's articles - disabled for now since timezone detection is client-side
    // We could potentially prefetch with a default timezone and refetch with the actual timezone
    // await queryClient.prefetchQuery({
    //     queryKey: [RSS_QUERY_KEYS.ARTICLES, {
    //         userTimezone: 'UTC', // Default fallback
    //         page: 1,
    //         size: 25,
    //         sortBy: "published_at",
    //         sortOrder: "desc",
    //         viewType: 'today',
    //         viewId: 'today',
    //     }],
    //     queryFn: () => ServerApiClient.getTodaysArticles({ userTimezone: 'UTC' }),
    // })

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <ArticlesSuspenseWrapper
                title="Today"
                showUnreadBadge={true}
                initialSidebarTitle="Today"
                mode="today"
            />
        </HydrationBoundary>
    )
}
