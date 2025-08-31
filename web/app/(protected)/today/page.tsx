import { getQueryClient } from "@/lib/get-query-client"
import { ArticlesSuspenseWrapper } from "@/components/articles/articles-suspense-wrapper"
import { ServerApiClient } from "@/lib/api/server"
import { RSS_QUERY_KEYS } from "@/lib/query-keys"
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"

// Force dynamic rendering since we're fetching user-specific data
export const dynamic = 'force-dynamic'

export default async function TodayPage() {
    // Get user's timezone - this will be executed on the server during SSR
    // and will use the server's timezone as a fallback (which should be fine for most use cases)
    // The real timezone detection happens client-side
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

    const queryClient = getQueryClient()

    // Prefetch today's articles using the new timezone-aware endpoint
    await queryClient.prefetchQuery({
        queryKey: [RSS_QUERY_KEYS.ARTICLES, {
            userTimezone,
            page: 1,
            size: 25,
            sortBy: "published_at",
            sortOrder: "desc",
            viewType: 'today',
            viewId: 'today',
        }],
        queryFn: () => ServerApiClient.getTodaysArticles({ userTimezone }),
    })

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <ArticlesSuspenseWrapper
                title="Today"
                showUnreadBadge={true}
                initialSidebarTitle="Today"
                mode="today"
                userTimezone={userTimezone}
            />
        </HydrationBoundary>
    )
}
