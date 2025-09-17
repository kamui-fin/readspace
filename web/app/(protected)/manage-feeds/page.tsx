import { getQueryClient } from "@/lib/get-query-client"
import { ApiClient } from "@readspace/shared"
import { RSS_QUERY_KEYS } from "@readspace/shared"
import ManageFeedsPageClient from "./manage-feeds-client"
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"

// Force dynamic rendering since we're fetching user-specific data
export const dynamic = "force-dynamic"

export const metadata = {
    title: "Manage Feeds | Readspace",
    description: "View, edit, and organize your RSS feeds",
}

export default async function ManageFeedsPage() {
    const queryClient = getQueryClient()

    // Prefetch feeds and folders data that the page needs
    await Promise.all([
        queryClient.prefetchQuery({
            queryKey: [RSS_QUERY_KEYS.FEEDS, {}],
            queryFn: () => ApiClient.rss.getFeeds({}),
        }),
        queryClient.prefetchQuery({
            queryKey: [RSS_QUERY_KEYS.FOLDERS],
            queryFn: () => ApiClient.rss.getFolders(),
        }),
    ])

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <ManageFeedsPageClient />
        </HydrationBoundary>
    )
}
