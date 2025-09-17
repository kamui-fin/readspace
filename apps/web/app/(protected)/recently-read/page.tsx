import { getQueryClient } from "@/lib/get-query-client"
import { ArticlesSuspenseWrapper } from "@/components/articles/articles-suspense-wrapper"
import { ApiClient } from "@readspace/shared"
import { RSS_QUERY_KEYS } from "@readspace/shared"
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"

// Force dynamic rendering since we're fetching user-specific data
export const dynamic = "force-dynamic"

export default async function RecentlyReadPage() {
    const queryClient = getQueryClient()

    // Prefetch infinite recently read articles to match client useInfiniteRecentlyReadArticles
    type PaginatedResponse = {
        page?: number
        pages?: number
        total_pages?: number
    }

    await queryClient.prefetchInfiniteQuery({
        queryKey: [
            RSS_QUERY_KEYS.ARTICLES,
            "infinite",
            "recently_read",
            { size: 25 },
        ],
        queryFn: ({ pageParam = 1 }) =>
            ApiClient.rss.getRecentlyReadArticles(pageParam, 25),
        initialPageParam: 1,
        getNextPageParam: (lastPage: PaginatedResponse) => {
            const currentPage = lastPage.page || 1
            const totalPages = lastPage.pages || lastPage.total_pages || 1
            return currentPage < totalPages ? currentPage + 1 : undefined
        },
        staleTime: 5 * 60 * 1000, // 5 minutes to match client
    })

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <ArticlesSuspenseWrapper
                mode="recentlyRead"
                initialSidebarTitle="Recently Read"
            />
        </HydrationBoundary>
    )
}
