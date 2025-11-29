import { Button } from "@/components/ui/button"
import { useRefreshFeed, useSubscribeToFeed } from "@readspace/shared"
import { Check, Plus } from "lucide-react"
import React, { useState } from "react"
import { BaseFeedCard } from "./BaseFeedCard"

interface OnboardingFeedCardProps {
    feed: {
        id: string
        title: string | null
        description: string | null
        url: string
        link: string | null
        image_url: string | null
        category?: string | null
        popularity_score?: number
    }
    onSubscribed?: (feedId: string) => void
    isFollowing?: boolean
}

export function OnboardingFeedCard({
    feed,
    onSubscribed,
    isFollowing = false,
}: OnboardingFeedCardProps) {
    const [isSubscribed, setIsSubscribed] = useState(isFollowing)
    const subscribeToFeed = useSubscribeToFeed()
    const refreshFeed = useRefreshFeed()

    // Update local state when isFollowing prop changes
    React.useEffect(() => {
        setIsSubscribed(isFollowing)
    }, [isFollowing])

    const handleSubscribe = async () => {
        if (isSubscribed) return

        // Immediately update UI for instant feedback
        setIsSubscribed(true)
        onSubscribed?.(feed.id)

        try {
            // Trigger background refresh - user doesn't need to wait
            refreshFeed.mutate({
                feedId: feed.id,
                forceRefetch: true,
            })

            // Subscribe to feed with default folder (backend will handle creating default folder)
            await subscribeToFeed.mutateAsync({
                feedId: feed.id,
                folderId: "default", // Backend will handle this
            })
        } catch (error) {
            // Revert UI state on error
            setIsSubscribed(false)
            console.error("Failed to subscribe:", error)
        }
    }

    return (
        <div className="px-2 md:px-4 w-full border-b border-border/40 last:border-0 py-4">
            <BaseFeedCard
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                feed={feed as any}
                showFollowButton={false}
                headerActions={
                    <Button
                        onClick={handleSubscribe}
                        disabled={isSubscribed}
                        className={`h-8 px-3 text-xs font-medium flex items-center gap-1.5 transition-colors ${
                            isSubscribed
                                ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/10 cursor-default"
                                : "bg-primary hover:bg-primary/90 text-primary-foreground"
                        }`}
                        variant={isSubscribed ? "outline" : "default"}
                    >
                        {isSubscribed ? (
                            <>
                                <Check className="w-3 h-3" />
                                Added
                            </>
                        ) : (
                            <>
                                <Plus className="w-3 h-3" />
                                Add
                            </>
                        )}
                    </Button>
                }
            />
        </div>
    )
}
