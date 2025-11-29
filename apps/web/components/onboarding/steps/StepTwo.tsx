import { Button } from "@/components/ui/button"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { useOnboardingStore } from "@/stores/onboarding"
import { meilisearchClient, FEEDS_INDEX_NAME } from "@/lib/meilisearch-client"
import { useFeeds } from "@readspace/shared"
import { useQuery } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { useRouter } from "next/navigation"
import React, { useState } from "react"
import OnboardingLayout from "../Layout"
import { OnboardingFeedCard } from "../OnboardingFeedCard"

type FeedDiscoveryResult = {
    id: string
    title: string | null
    description: string | null
    url: string
    link: string | null
    image_url: string | null
    category?: string | null
    popularity_score?: number
}

type OnboardingFeed = FeedDiscoveryResult

const StepTwo: React.FC = () => {
    const { onboardingData, updateOnboardingData, prevStep } =
        useOnboardingStore()
    const [followedFeeds, setFollowedFeeds] = useState<string[]>(
        onboardingData.followedFeeds || []
    )
    const [displayedFeeds, setDisplayedFeeds] = useState<OnboardingFeed[]>([])
    const { user } = useCurrentUser()
    const router = useRouter()

    // Get user's subscribed feeds to check which ones are already followed
    const { data: subscribedFeeds } = useFeeds(
        {},
        {
            refetchOnMount: false,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            staleTime: 10 * 60 * 1000,
        }
    )

    // Fetch feeds for selected categories using Meilisearch multi-search
    const {
        data: feedsData,
        isLoading,
        error,
    } = useQuery({
        queryKey: ["onboarding-feeds", onboardingData.selectedCategories],
        queryFn: async () => {
            if (onboardingData.selectedCategories.length === 0) {
                return []
            }

            // Use multi-search to query each category separately
            // This ensures fair representation across categories with different popularity score distributions
            const queries = onboardingData.selectedCategories.map(
                (category) => ({
                    indexUid: FEEDS_INDEX_NAME,
                    q: "",
                    filter: `top_level_category = "${category}" AND language = "en"`,
                    limit: 20, // Get top 20 from each category
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
                })
            )

            const multiSearchResults = await meilisearchClient.multiSearch({
                queries,
            })

            // Interleave results from different categories for diversity
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

            // Interleave: take one from each category in round-robin fashion
            const maxLength = Math.max(...categoryResults.map((r) => r.length))
            for (let i = 0; i < maxLength; i++) {
                for (const categoryFeeds of categoryResults) {
                    if (i < categoryFeeds.length) {
                        interleavedFeeds.push(categoryFeeds[i]!)
                    }
                }
            }

            return interleavedFeeds
        },
        enabled: onboardingData.selectedCategories.length > 0,
    })

    // Initialize displayed feeds when data loads
    React.useEffect(() => {
        if (feedsData) {
            setDisplayedFeeds(feedsData)
        }
    }, [feedsData])

    const handleFeedSubscribed = async (feedId: string) => {
        const newFollowedFeeds = [...followedFeeds, feedId]
        setFollowedFeeds(newFollowedFeeds)
        updateOnboardingData({ followedFeeds: newFollowedFeeds })

        // Fetch and insert similar feeds
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

            // Insert similar feeds right after the current feed
            setDisplayedFeeds((prev) => {
                const feedIndex = prev.findIndex((f) => f.id === feedId)
                if (feedIndex === -1) return prev

                const newFeeds = [...prev]
                // Filter out duplicates and insert after current feed
                const uniqueSimilar = similarFeeds.filter(
                    (sf) => !newFeeds.some((f) => f.id === sf.id)
                )
                newFeeds.splice(feedIndex + 1, 0, ...uniqueSimilar)
                return newFeeds
            })
        } catch (error) {
            console.error("Failed to fetch similar feeds:", error)
        }
    }

    const handleBack = () => {
        updateOnboardingData({ followedFeeds })
        prevStep()
    }

    const handleComplete = async () => {
        if (!user) return

        try {
            // Redirect to main app
            router.push("/today")
        } catch (error) {
            console.error("Failed to complete onboarding:", error)
        }
    }

    const canComplete = followedFeeds.length >= 3

    if (isLoading) {
        return (
            <OnboardingLayout
                title="Curating your newsfeed..."
                subtitle="Finding quality sources that match your interests"
            >
                <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div
                            key={i}
                            className="bg-card border border-border rounded-xl p-4 animate-pulse"
                        >
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-muted rounded-xl"></div>
                                <div className="flex-1">
                                    <div className="flex items-start justify-between gap-3 mb-2">
                                        <div className="h-5 bg-muted rounded w-3/4"></div>
                                        <div className="w-16 h-8 bg-muted rounded"></div>
                                    </div>
                                    <div className="h-3 bg-muted/70 rounded w-1/2 mb-2"></div>
                                    <div className="h-4 bg-muted/70 rounded w-full"></div>
                                    <div className="h-4 bg-muted/70 rounded w-2/3 mt-1"></div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </OnboardingLayout>
        )
    }

    if (error || !feedsData?.length) {
        return (
            <OnboardingLayout
                title="Having trouble finding sources"
                subtitle="We couldn't load publications for your selected topics. Let's try again."
            >
                <div className="text-center py-8">
                    <p className="text-gray-600 mb-4">
                        We couldn&apos;t load publications for your selected
                        topics.
                    </p>
                    <div className="flex gap-3">
                        <Button
                            onClick={handleBack}
                            variant="outline"
                            className="flex-1"
                        >
                            Go Back
                        </Button>
                        <Button
                            asChild
                            className="flex-1 bg-primary hover:bg-primary-light"
                        >
                            <Link href="/today">Continue Anyway</Link>
                        </Button>
                    </div>
                </div>
            </OnboardingLayout>
        )
    }

    return (
        <OnboardingLayout
            title="Add sources to your newsfeed"
            subtitle="Choose at least 3 publications to start building your reading list"
        >
            <div className="max-h-96 overflow-y-auto pr-2">
                <AnimatePresence initial={false}>
                    {displayedFeeds.map(
                        (feed: OnboardingFeed) => (
                            <motion.div
                                key={feed.id}
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{
                                    duration: 0.2,
                                    ease: "easeOut",
                                }}
                                style={{ overflow: "hidden" }}
                            >
                                <motion.div
                                    initial={{
                                        opacity: 0,
                                        y: -8,
                                        scale: 0.98,
                                    }}
                                    animate={{
                                        opacity: 1,
                                        y: 0,
                                        scale: 1,
                                    }}
                                    exit={{
                                        opacity: 0,
                                        y: 8,
                                        scale: 0.98,
                                    }}
                                    transition={{
                                        duration: 0.15,
                                        ease: "easeOut",
                                    }}
                                >
                                    <OnboardingFeedCard
                                        feed={feed}
                                        onSubscribed={handleFeedSubscribed}
                                        isFollowing={
                                            subscribedFeeds?.some(
                                                (f) => f.id === feed.id
                                            ) ?? false
                                        }
                                    />
                                </motion.div>
                            </motion.div>
                        )
                    )}
                </AnimatePresence>
            </div>

            {followedFeeds.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center text-sm mt-4"
                >
                    {followedFeeds.length} source
                    {followedFeeds.length === 1 ? "" : "s"} added
                    {followedFeeds.length < 3 &&
                        ` • ${3 - followedFeeds.length} more to go`}
                </motion.div>
            )}

            <div className="mt-6 flex gap-3">
                <Button
                    onClick={handleBack}
                    className="w-1/3"
                    variant="outline"
                >
                    Back
                </Button>
                <Button
                    onClick={handleComplete}
                    disabled={!canComplete}
                    className="w-2/3 bg-primary hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {canComplete
                        ? "Start Reading!"
                        : `Add ${3 - followedFeeds.length} More`}
                </Button>
            </div>
        </OnboardingLayout>
    )
}

export default StepTwo
