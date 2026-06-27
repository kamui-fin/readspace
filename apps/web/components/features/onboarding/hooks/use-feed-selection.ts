import { useCurrentUser } from "@/hooks/use-current-user"
import { useOnboardingStore } from "@/stores/onboarding"
import { useFeeds, ApiClient } from "@readspace/shared"
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
    const { data: feedsResponse } = useFeeds(
        {},
        {
            refetchOnMount: false,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            staleTime: 10 * 60 * 1000,
        }
    )
    const subscribedFeeds = feedsResponse?.subscriptions

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
            // Mark the user as onboarded so future sign-ins don't re-trigger this flow
            await ApiClient.patch("/api/users/profile", { is_onboarded: true })
        } catch (e) {
            console.warn("Failed to mark user as onboarded:", e)
        }
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
