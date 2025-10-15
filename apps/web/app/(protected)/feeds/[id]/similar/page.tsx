import "@/lib/configure-api-client"
import { getQueryClient } from "@/lib/get-query-client"
import { ApiClient } from "@readspace/shared"
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import SimilarFeedsClient from "./similar-client"

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
