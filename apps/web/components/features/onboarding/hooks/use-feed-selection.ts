import { useCurrentUser } from "@/hooks/use-current-user"
import { useOnboardingStore } from "@/stores/onboarding"
import { useFeeds } from "@readspace/shared"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useOnboardingFeeds } from "@/components/features/onboarding/hooks/use-onboarding-feeds"

export function useFeedSelection() {
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

    return {
        displayedFeeds,
        isLoading,
        error,
        followedFeeds,
        subscribedFeeds,
        handleFeedSubscribed,
        handleBack,
        handleComplete,
        canComplete,
    }
}
