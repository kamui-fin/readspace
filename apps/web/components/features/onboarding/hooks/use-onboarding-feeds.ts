import { meilisearchClient, FEEDS_INDEX_NAME } from "@/lib/meilisearch-client"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"

export type OnboardingFeed = {
    id: string
    title: string | null
    description: string | null
    url: string
    link: string | null
    image_url: string | null
    category?: string | null
    popularity_score?: number
}

export function useOnboardingFeeds(selectedCategories: string[]) {
    const [displayedFeeds, setDisplayedFeeds] = useState<OnboardingFeed[]>([])

    const {
        data: feedsData,
        isLoading,
        error,
    } = useQuery({
        queryKey: ["onboarding-feeds", selectedCategories],
        queryFn: async () => {
            if (selectedCategories.length === 0) {
                return []
            }

            const queries = selectedCategories.map((category) => ({
                indexUid: FEEDS_INDEX_NAME,
                q: "",
                filter: `top_level_category = "${category}" AND language = "en"`,
                limit: 20,
                sort: ["popularity_score:desc"],
                attributesToRetrieve: [
                    "id",
                    "title",
                    "description",
                    "url",
                    "link",
                    "image_url",
                    "top_level_category",
                    "popularity_score",
                ],
            }))

            const multiSearchResults = await meilisearchClient.multiSearch({
                queries,
            })

            const interleavedFeeds: OnboardingFeed[] = []
            const categoryResults = multiSearchResults.results.map(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (result: { hits: any[] }) =>
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    result.hits.map((hit: any) => ({
                        id: hit.id,
                        title: hit.title,
                        description: hit.description,
                        url: hit.url,
                        link: hit.link,
                        image_url: hit.image_url,
                        category: hit.top_level_category,
                        popularity_score: hit.popularity_score,
                    }))
            )

            const maxLength = Math.max(
                ...categoryResults.map((r: OnboardingFeed[]) => r.length)
            )
            for (let i = 0; i < maxLength; i++) {
                for (const categoryFeeds of categoryResults) {
                    if (i < categoryFeeds.length) {
                        interleavedFeeds.push(categoryFeeds[i]!)
                    }
                }
            }

            return interleavedFeeds
        },
        enabled: selectedCategories.length > 0,
    })

    useEffect(() => {
        if (feedsData) {
            setDisplayedFeeds(feedsData)
        }
    }, [feedsData])

    const fetchSimilarFeeds = async (feedId: string) => {
        try {
            const index = meilisearchClient.index(FEEDS_INDEX_NAME)
            const results = await index.searchSimilarDocuments({
                id: feedId,
                limit: 3,
                embedder: "default",
                showRankingScore: true,
                filter: 'language = "en"',
            })

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const similarFeeds = results.hits.map((hit: any) => ({
                id: hit.id,
                title: hit.title,
                description: hit.description,
                url: hit.url,
                link: hit.link,
                image_url: hit.image_url,
                category: hit.top_level_category,
                popularity_score: hit.popularity_score,
            }))

            setDisplayedFeeds((prev) => {
                const feedIndex = prev.findIndex((f) => f.id === feedId)
                if (feedIndex === -1) return prev

                const newFeeds = [...prev]
                const uniqueSimilar = similarFeeds.filter(
                    (sf: OnboardingFeed) =>
                        !newFeeds.some((f) => f.id === sf.id)
                )
                newFeeds.splice(feedIndex + 1, 0, ...uniqueSimilar)
                return newFeeds
            })
        } catch (error) {
            console.error("Failed to fetch similar feeds:", error)
        }
    }

    return {
        displayedFeeds,
        isLoading,
        error,
        fetchSimilarFeeds,
    }
}
