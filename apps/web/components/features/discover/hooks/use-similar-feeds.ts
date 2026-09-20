import { FEEDS_INDEX_NAME, meilisearchClient } from "@/lib/meilisearch-client"
import { useQuery } from "@tanstack/react-query"
import { type FeedSummary, type ContentType, type FeedCategory } from "@readspace/shared"
import { ApiClient } from "@/lib/api-client"

export interface MeilisearchHit {
    id: string
    url: string
    title: string
    description?: string | null
    link?: string | null
    language?: string | null
    image_url?: string | null
    author?: string | null
    content_type?: string | null
    tags?: string[]
    tags_native?: string[]
    top_level_category?: string | null
    popularity_score?: number | null
    frontend_rank_override?: number | null
    _rankingScore?: number
}

function convertHitToFeed(hit: MeilisearchHit): FeedSummary {
    return {
        id: hit.id,
        url: hit.url,
        title: hit.title || "Untitled",
        link: hit.link ?? null,
        image_url: hit.image_url ?? null,
        language: hit.language ?? "en",
        author: hit.author ?? null,
        content_type: (hit.content_type as ContentType) ?? null,
        tags: hit.tags ?? [],
        tags_native: hit.tags_native ?? [],
        top_level_category: (hit.top_level_category as FeedCategory) ?? null,
        description: hit.description ?? null,
        popularity_score: hit.popularity_score ?? undefined,
        frontend_rank_override: hit.frontend_rank_override ?? undefined,
    }
}

export function useSimilarFeeds(feedId: string, customFilter?: string) {
    const languageFilter = customFilter ?? `language = "en"`

    // Fetch similar feeds from Meilisearch
    const {
        data: similarResults,
        error: similarError,
        isLoading: isSimilarLoading,
    } = useQuery({
        queryKey: ["similarFeeds", feedId, languageFilter],
        queryFn: async () => {
            const index = meilisearchClient.index(FEEDS_INDEX_NAME)
            const results = await index.searchSimilarDocuments({
                id: feedId,
                limit: 50,
                embedder: "default",
                showRankingScore: true,
                filter: languageFilter,
            })
            return results
        },
        staleTime: 5 * 60 * 1000,
        retry: 2,
        enabled: Boolean(feedId),
    })

    // Fetch anchor feed details if needed
    const { data: anchorFeed, isLoading: isAnchorLoading } = useQuery({
        queryKey: ["anchorFeed", feedId],
        queryFn: async () => {
            if (!feedId) return null
            try {
                const res = await ApiClient.getFeed(feedId)
                return res
            } catch {
                return null
            }
        },
        staleTime: 10 * 60 * 1000,
        enabled: Boolean(feedId),
    })

    const similarFeeds = (similarResults?.hits || []).map((hit) =>
        convertHitToFeed(hit as MeilisearchHit)
    )

    return {
        similarFeeds,
        anchorFeed,
        error: similarError,
        isLoading: isSimilarLoading || (Boolean(feedId) && isAnchorLoading),
    }
}
