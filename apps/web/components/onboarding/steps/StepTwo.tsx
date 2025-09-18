import { Button } from "@/components/ui/button"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { useOnboardingStore } from "@/stores/onboarding"
import { ApiClient } from "@readspace/shared"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import React, { useState } from "react"
import OnboardingLayout from "../Layout"
import { OnboardingFeedCard } from "../OnboardingFeedCard"

// API response type for search feeds
type DiscoverSearchResponse = {
    results: FeedDiscoveryResult[]
    total_count: number
    query: string | null
    category: string | null
    language: string
}

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
    const { user } = useCurrentUser()
    const router = useRouter()

    // Fetch feeds for selected categories
    const {
        data: feedsData,
        isLoading,
        error,
    } = useQuery({
        queryKey: ["onboarding-feeds", onboardingData.selectedCategories],
        queryFn: async () => {
            const promises = onboardingData.selectedCategories.map((category) =>
                ApiClient.rss.searchFeeds({
                    category,
                    limit: 8, // Get top 8 per category
                })
            )

            const results = await Promise.all(promises)

            // Combine and deduplicate feeds from all categories
            const allFeeds = results.flatMap(
                (result: DiscoverSearchResponse) => result.results
            )
            const uniqueFeeds = allFeeds.filter(
                (feed, index, self) =>
                    index === self.findIndex((f) => f.id === feed.id)
            )

            // Sort by popularity and take top 20
            return uniqueFeeds
                .sort(
                    (a, b) =>
                        (b.popularity_score || 0) - (a.popularity_score || 0)
                )
                .slice(0, 20)
        },
        enabled: onboardingData.selectedCategories.length > 0,
    })

    const handleFeedSubscribed = (feedId: string) => {
        const newFollowedFeeds = [...followedFeeds, feedId]
        setFollowedFeeds(newFollowedFeeds)
        updateOnboardingData({ followedFeeds: newFollowedFeeds })
    }

    const handleBack = () => {
        updateOnboardingData({ followedFeeds })
        prevStep()
    }

    const handleComplete = async () => {
        if (!user) return

        try {
            // Redirect to main app
            router.push("/articles")
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
                            onClick={() => router.push("/library")}
                            className="flex-1 bg-primary hover:bg-primary-light"
                        >
                            Continue Anyway
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
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                {feedsData.map((feed: OnboardingFeed, index: number) => (
                    <motion.div
                        key={feed.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                            duration: 0.3,
                            delay: index * 0.1,
                            ease: "easeOut",
                        }}
                    >
                        <OnboardingFeedCard
                            feed={feed}
                            onSubscribed={handleFeedSubscribed}
                        />
                    </motion.div>
                ))}
            </div>

            {followedFeeds.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center text-sm text-gray-600 mt-4"
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
