import { getQueryClient } from "@/lib/get-query-client"
import { ApiClient, type SimilarFeedsResponse } from "@readspace/shared"
import SimilarFeedsClient from "./similar-client"
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"

// Force dynamic rendering since we're fetching data
export const dynamic = "force-dynamic"

export async function generateMetadata({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params

    // Try to get the source feed info from similar feeds API for metadata
    try {
        const similarData: SimilarFeedsResponse =
            await ApiClient.rss.getSimilarFeeds(id, {
                limit: 1,
            })
        const sourceFeed = similarData.source_feed

        if (sourceFeed?.title) {
            return {
                title: `Similar to ${sourceFeed.title} | Readspace`,
                description: `Discover RSS feeds similar to ${sourceFeed.title}`,
            }
        }
    } catch (error) {
        console.error("Failed to fetch feed for metadata:", error)
    }

    return {
        title: "Similar Feeds | Readspace",
        description: "Discover similar RSS feeds",
    }
}

export default async function SimilarFeedsPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id: feedId } = await params
    const queryClient = getQueryClient()

    // Prefetch similar feeds data (which includes source feed info)
    await queryClient.prefetchQuery({
        queryKey: ["similarFeeds", feedId],
        queryFn: () => ApiClient.rss.getSimilarFeeds(feedId, { limit: 10 }),
    })

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <SimilarFeedsClient feedId={feedId} />
        </HydrationBoundary>
    )
}
