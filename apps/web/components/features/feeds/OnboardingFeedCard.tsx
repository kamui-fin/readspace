import { Button } from "@/components/ui/button"
import { useRefreshFeed, useCreateFeed } from "@readspace/shared"
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
    const createFeed = useCreateFeed()
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
            await createFeed.mutateAsync({
                url: feed.url,
                folder_id: "default", // Backend will handle this
            })
        } catch (error) {
            // Revert UI state on error
            setIsSubscribed(false)
            console.error("Failed to subscribe:", error)
        }
    }

    // Normalize feed to FeedSummary type
    const normalizedFeed = {
        id: feed.id,
        url: feed.url,
        title: feed.title || "Untitled Feed",
        link: feed.link,
        image_url: feed.image_url,

        description: feed.description,
        language: "en",
        author: null,
        content_type: null,
        tags_native: [],
    }

    return (
        <div className="px-2 md:px-4 w-full border-b border-border/40 last:border-0 py-4">
            <BaseFeedCard
                feed={normalizedFeed}
                showFollowButton={false}
                headerActions={
                    <Button
                        onClick={handleSubscribe}
                        disabled={isSubscribed}
                        className={`h-8 px-3 text-xs font-medium flex items-center gap-1.5 transition-colors ${isSubscribed
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
