import { ArticlesSuspenseWrapper } from "@/components/articles/ArticlesSuspenseWrapper"
import { getQueryClient } from "@/lib/get-query-client"
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"

// Force dynamic rendering since we're fetching user-specific data
export const dynamic = "force-dynamic"

export default async function TodayPage() {
    const queryClient = getQueryClient()

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <ArticlesSuspenseWrapper
                showUnreadBadge={true}
                initialSidebarTitle="Today"
                mode="today"
            />
        </HydrationBoundary>
    )
}
