import { FEEDS_INDEX_NAME, meilisearchClient } from "@/lib/meilisearch-client"
import { useQuery } from "@tanstack/react-query"
import { type FeedSummary } from "@readspace/shared"

export interface MeilisearchHit {
    id: string
    url: string
    title: string
    description?: string | null
    link?: string | null
    language?: string | null
    image_url?: string | null
    tags?: string[]
    top_level_category?: string | null
    popularity_score?: number | null
    _rankingScore?: number
}

function convertHitToFeed(hit: MeilisearchHit): FeedSummary {
    return {
        id: hit.id,
        url: hit.url,
        title: hit.title,
        link: hit.link ?? null,
        image_url: hit.image_url ?? null,
        error_count: 0,
    }
}

export function useSimilarFeeds(feedId: string) {
    const {
        data: similarResults,
        error,
        isLoading,
    } = useQuery({
        queryKey: ["similarFeeds", feedId],
        queryFn: async () => {
            const index = meilisearchClient.index(FEEDS_INDEX_NAME)
            const results = await index.searchSimilarDocuments({
                id: feedId,
                limit: 50,
                embedder: "default",
                showRankingScore: true,
            })
            return results
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        retry: 2,
        enabled: !!feedId,
    })

    const similarFeeds = (similarResults?.hits || []).map((hit) =>
        convertHitToFeed(hit as MeilisearchHit)
    )

    return {
        similarFeeds,
        error,
        isLoading,
    }
}
