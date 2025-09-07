import { Button } from "@/components/ui/button"
import { useCurrentUser } from "@/hooks/use-current-user"
import { ApiClient } from "@/lib/api/client"
import { useOnboardingStore } from "@/stores/onboarding"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import React, { useState } from "react"
import OnboardingLayout from "../layout"
import { OnboardingFeedCard } from "../OnboardingFeedCard"

const StepTwo: React.FC = () => {
    const { onboardingData, updateOnboardingData, prevStep } = useOnboardingStore()
    const [followedFeeds, setFollowedFeeds] = useState<string[]>(
        onboardingData.followedFeeds || []
    )
    const { user } = useCurrentUser()
    const router = useRouter()

    // Fetch feeds for selected categories
    const { data: feedsData, isLoading, error } = useQuery({
        queryKey: ['onboarding-feeds', onboardingData.selectedCategories],
        queryFn: async () => {
            const promises = onboardingData.selectedCategories.map(category =>
                ApiClient.rss.searchFeeds({
                    category,
                    limit: 8 // Get top 8 per category
                })
            )

            const results = await Promise.all(promises)

            // Combine and deduplicate feeds from all categories
            const allFeeds = results.flatMap(result => result.results)
            const uniqueFeeds = allFeeds.filter((feed, index, self) =>
                index === self.findIndex(f => f.id === feed.id)
            )

            // Sort by popularity and take top 20
            return uniqueFeeds
                .sort((a, b) => (b.popularity_score || 0) - (a.popularity_score || 0))
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
            // TODO: Mark onboarding as completed in user preferences/metadata

            // Redirect to main app
            router.push("/articles")
        } catch (error) {
            console.error('Failed to complete onboarding:', error)
        }
    }

    const canComplete = followedFeeds.length >= 3

    if (isLoading) {
        return (
            <OnboardingLayout
                title="Finding feeds for you..."
                subtitle="Based on your interests, we're finding the best feeds"
            >
                <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="p-3 border border-border rounded-lg animate-pulse">
                            <div className="flex gap-3">
                                <div className="w-8 h-8 bg-muted rounded"></div>
                                <div className="flex-1">
                                    <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                                    <div className="h-3 bg-muted/70 rounded w-1/2 mb-1"></div>
                                    <div className="h-3 bg-muted/50 rounded w-full"></div>
                                </div>
                                <div className="w-16 h-7 bg-muted rounded"></div>
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
                title="Something went wrong"
                subtitle="We couldn't find feeds for your interests. Let's try again."
            >
                <div className="text-center py-8">
                    <p className="text-gray-600 mb-4">
                        We couldn't load feeds for your selected categories.
                    </p>
                    <div className="flex gap-3">
                        <Button onClick={handleBack} variant="outline" className="flex-1">
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
            title="Follow your first feeds"
            subtitle="Pick at least 3 feeds to get started with fresh content"
        >
            <div className="space-y-3 max-h-96 overflow-y-auto">
                {feedsData.map((feed: any, index: number) => (
                    <motion.div
                        key={feed.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                            duration: 0.3,
                            delay: index * 0.1,
                            ease: "easeOut"
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
                    {followedFeeds.length} feed{followedFeeds.length === 1 ? '' : 's'} followed
                    {followedFeeds.length < 3 && ` • ${3 - followedFeeds.length} more to go`}
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
                    {canComplete ? "Let's Read!" : `Follow ${3 - followedFeeds.length} More`}
                </Button>
            </div>
        </OnboardingLayout>
    )
}

export default StepTwo
