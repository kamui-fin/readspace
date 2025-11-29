import { Button } from "@/components/ui/button"
import { useCurrentUser } from "@/hooks/use-current-user"
import { useOnboardingStore } from "@/stores/onboarding"
import { useFeeds } from "@readspace/shared"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import React, { useState } from "react"
import OnboardingLayout from "../OnboardingLayout"
import { OnboardingFeedCard } from "@/components/features/feeds/OnboardingFeedCard"
import {
    useOnboardingFeeds,
    type OnboardingFeed,
} from "@/hooks/use-onboarding-feeds"
import {
    OnboardingLoadingState,
    OnboardingErrorState,
} from "./OnboardingStates"

const FeedSelectionStep: React.FC = () => {
    const { onboardingData, updateOnboardingData, prevStep } =
        useOnboardingStore()
    const [followedFeeds, setFollowedFeeds] = useState<string[]>(
        onboardingData.followedFeeds || []
    )
    const { user } = useCurrentUser()
    const router = useRouter()

    const { displayedFeeds, isLoading, error, fetchSimilarFeeds } =
        useOnboardingFeeds(onboardingData.selectedCategories)

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

    const handleFeedSubscribed = async (feedId: string) => {
        const newFollowedFeeds = [...followedFeeds, feedId]
        setFollowedFeeds(newFollowedFeeds)
        updateOnboardingData({ followedFeeds: newFollowedFeeds })

        await fetchSimilarFeeds(feedId)
    }

    const handleBack = () => {
        updateOnboardingData({ followedFeeds })
        prevStep()
    }

    const handleComplete = async () => {
        if (!user) return
        try {
            router.push("/today")
        } catch (error) {
            console.error("Failed to complete onboarding:", error)
        }
    }

    const canComplete = followedFeeds.length >= 3

    if (isLoading) {
        return <OnboardingLoadingState />
    }

    if (error || !displayedFeeds?.length) {
        return <OnboardingErrorState onBack={handleBack} />
    }

    return (
        <OnboardingLayout
            title="Add sources to your newsfeed"
            subtitle="Choose at least 3 publications to start building your reading list"
        >
            <div className="max-h-96 overflow-y-auto pr-2">
                <AnimatePresence initial={false}>
                    {displayedFeeds.map((feed: OnboardingFeed) => (
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
                    ))}
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

export default FeedSelectionStep
