import { meilisearchClient, FEEDS_INDEX_NAME } from "@/lib/meilisearch-client"
import {
    buildOnboardingFeedQueries,
    interleaveOnboardingFeeds,
    mapHitToOnboardingFeed,
    type OnboardingFeed,
} from "@readspace/shared"
import { useQuery } from "@tanstack/react-query"
import { useCallback, useMemo, useState } from "react"

export type { OnboardingFeed }

type SimilarInsertion = {
    anchorId: string
    feeds: OnboardingFeed[]
}

/**
 * Merge the query's base feed list with any "similar feed" groups the user has
 * pulled in by subscribing. Each group is spliced in right after its anchor,
 * skipping feeds already present. Derived synchronously so there is never a
 * render where the query has resolved but the list is still empty (which is
 * what briefly flashed the error state).
 */
function mergeSimilarFeeds(
    base: OnboardingFeed[],
    insertions: SimilarInsertion[]
): OnboardingFeed[] {
    const merged = [...base]

    for (const { anchorId, feeds } of insertions) {
        const anchorIndex = merged.findIndex((f) => f.id === anchorId)
        if (anchorIndex === -1) continue

        const seen = new Set(merged.map((f) => f.id))
        const unique = feeds.filter((f) => !seen.has(f.id))
        merged.splice(anchorIndex + 1, 0, ...unique)
    }

    return merged
}

export function useOnboardingFeeds(selectedCategories: string[]) {
    const [similarInsertions, setSimilarInsertions] = useState<
        SimilarInsertion[]
    >([])

    const {
        data: feedsData,
        isLoading,
        isError,
    } = useQuery({
        queryKey: ["onboarding-feeds", selectedCategories],
        queryFn: async () => {
            if (selectedCategories.length === 0) {
                return []
            }

            const queries = buildOnboardingFeedQueries(
                FEEDS_INDEX_NAME,
                selectedCategories,
                20
            )

            const multiSearchResults = await meilisearchClient.multiSearch({
                queries,
            })

            const categoryResults = multiSearchResults.results.map(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (result: { hits: any[] }) =>
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    result.hits.map((hit: any) => mapHitToOnboardingFeed(hit))
            )

            return interleaveOnboardingFeeds(categoryResults)
        },
        enabled: selectedCategories.length > 0,
    })

    const displayedFeeds = useMemo(
        () => mergeSimilarFeeds(feedsData ?? [], similarInsertions),
        [feedsData, similarInsertions]
    )

    const fetchSimilarFeeds = useCallback(async (feedId: string) => {
        try {
            const index = meilisearchClient.index(FEEDS_INDEX_NAME)
            const results = await index.searchSimilarDocuments({
                id: feedId,
                limit: 3,
                embedder: "default",
                showRankingScore: true,
                filter: 'language = "en"',
            })

            const similarFeeds: OnboardingFeed[] = results.hits.map(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (hit: any) => ({
                    id: hit.id,
                    title: hit.title,
                    description: hit.description,
                    url: hit.url,
                    link: hit.link,
                    image_url: hit.image_url,
                    category: hit.top_level_category,
                    popularity_score: hit.popularity_score,
                })
            )

            if (similarFeeds.length === 0) return

            setSimilarInsertions((prev) => {
                if (prev.some((insertion) => insertion.anchorId === feedId)) {
                    return prev
                }
                return [...prev, { anchorId: feedId, feeds: similarFeeds }]
            })
        } catch (error) {
            console.error("Failed to fetch similar feeds:", error)
        }
    }, [])

    return {
        displayedFeeds,
        isLoading,
        isError,
        fetchSimilarFeeds,
    }
}
