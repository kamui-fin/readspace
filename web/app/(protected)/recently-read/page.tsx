import { getQueryClient } from "@/lib/get-query-client"
import { ArticlesSuspenseWrapper } from "@/components/articles/articles-suspense-wrapper"
import { ServerApiClient } from "@/lib/api/server"
import { RSS_QUERY_KEYS } from "@/lib/query-keys"
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"

// Force dynamic rendering since we're fetching user-specific data
export const dynamic = 'force-dynamic'

export default async function RecentlyReadPage() {
    const queryClient = getQueryClient()

    // Prefetch infinite recently read articles to match client useInfiniteRecentlyReadArticles
    await queryClient.prefetchInfiniteQuery({
        queryKey: [RSS_QUERY_KEYS.ARTICLES, 'infinite', 'recently_read', { size: 25 }],
        queryFn: ({ pageParam = 1 }) => ServerApiClient.getRecentlyReadArticles(pageParam, 25),
        initialPageParam: 1,
        getNextPageParam: (lastPage: any) => {
            const currentPage = lastPage.page || 1
            const totalPages = lastPage.pages || lastPage.total_pages || 1
            return currentPage < totalPages ? currentPage + 1 : undefined
        },
        staleTime: 5 * 60 * 1000, // 5 minutes to match client
    })

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <ArticlesSuspenseWrapper 
                title="Recently Read"
                mode="recentlyRead"
                initialSidebarTitle="Recently Read"
            />
        </HydrationBoundary>
    )
}
