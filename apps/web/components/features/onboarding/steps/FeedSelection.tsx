import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import React from "react"
import OnboardingLayout from "../OnboardingLayout"
import { OnboardingFeedCard } from "@/components/features/feeds/OnboardingFeedCard"
import { type OnboardingFeed } from "@/components/features/onboarding/hooks/use-onboarding-feeds"
import {
    OnboardingLoadingState,
    OnboardingErrorState,
    OnboardingEmptyState,
} from "./OnboardingStates"
import { useFeedSelection } from "@/components/features/onboarding/hooks/use-feed-selection"

const FeedSelectionStep: React.FC = () => {
    const {
        displayedFeeds,
        isLoading,
        isError,
        followedFeeds,
        subscribedFeeds,
        handleFeedSubscribed,
        handleBack,
        handleComplete,
        canComplete,
    } = useFeedSelection()

    if (isLoading) {
        return <OnboardingLoadingState />
    }

    // Only a genuine query failure shows the error state. An empty-but-successful
    // result gets its own copy instead of masquerading as "couldn't connect".
    if (isError) {
        return <OnboardingErrorState onBack={handleBack} />
    }

    if (!displayedFeeds?.length) {
        return <OnboardingEmptyState onBack={handleBack} />
    }

    return (
        <OnboardingLayout
            title="Add sources to your newsfeed"
            subtitle="Choose at least 3 publications to start building your reading list"
        >
            <div className="max-h-[520px] overflow-y-auto pr-2">
                <div className="space-y-1">
                    {displayedFeeds.map((feed: OnboardingFeed, index) => (
                        <motion.div
                            key={feed.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                duration: 0.25,
                                delay: Math.min(index * 0.02, 0.25),
                                ease: [0.16, 1, 0.3, 1],
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
                    ))}
                </div>
            </div>

            <div className="mt-10 w-full flex justify-center gap-3">
                <Button
                    onClick={handleBack}
                    variant="outline"
                    className="w-32 h-12 rounded-xl cursor-pointer select-none"
                >
                    Back
                </Button>
                <Button
                    onClick={handleComplete}
                    disabled={!canComplete}
                    className="w-48 h-12 bg-primary hover:bg-primary/95 text-white font-semibold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer select-none transition-all shadow-xs"
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
