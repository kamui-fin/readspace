import { FEEDS_INDEX_NAME, meilisearchClient } from "@/lib/meilisearch-client"
import { usePersistentState } from "@/hooks/use-persistent-state"
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
    frontend_rank_override?: number | null
    _rankingScore?: number
}

function convertHitToFeed(hit: MeilisearchHit): FeedSummary {
    return {
        id: hit.id,
        url: hit.url,
        title: hit.title,
        link: hit.link ?? null,
        image_url: hit.image_url ?? null,
        language: hit.language ?? "en",
        author: null, // Meili might have author? MeilisearchHit definition below needs check
        content_type: null,
        tags_native: [],
        description: hit.description ?? null,
        popularity_score: hit.popularity_score ?? undefined,
        frontend_rank_override: hit.frontend_rank_override ?? undefined,
    } as FeedSummary // Warning: casting or ensure all fields
}

export function useSimilarFeeds(feedId: string) {
    // Carry the discover screen's persisted language preference into similar-feeds
    // results. The similar page opens in a new tab, so localStorage (shared by
    // `usePersistentState`) is the only channel that survives — props/context don't.
    // `"all"` (or an empty value) means no language filter, matching discover.
    const [language, , isLanguageReady] = usePersistentState(
        "discover-language",
        "en"
    )
    const languageFilter =
        language && language !== "all" ? `language = "${language}"` : undefined

    const {
        data: similarResults,
        error,
        isLoading,
    } = useQuery({
        queryKey: ["similarFeeds", feedId, languageFilter ?? "all"],
        queryFn: async () => {
            const index = meilisearchClient.index(FEEDS_INDEX_NAME)
            const results = await index.searchSimilarDocuments({
                id: feedId,
                limit: 50,
                embedder: "default",
                showRankingScore: true,
                ...(languageFilter ? { filter: languageFilter } : {}),
            })
            return results
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        retry: 2,
        // Wait for localStorage to be read so the first fetch already carries the
        // correct filter instead of firing with the "en" default then refetching.
        enabled: !!feedId && isLanguageReady,
    })

    const similarFeeds = (similarResults?.hits || []).map((hit) =>
        convertHitToFeed(hit as MeilisearchHit)
    )

    return {
        similarFeeds,
        error,
        // Keep the skeleton up while the query is disabled waiting on localStorage,
        // so the empty state doesn't flash before the first fetch starts.
        isLoading: isLoading || !isLanguageReady,
    }
}
