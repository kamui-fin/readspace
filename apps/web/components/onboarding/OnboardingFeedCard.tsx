import { Button } from "@/components/ui/button"
import { useRefreshFeed, useSubscribeToFeed } from "@readspace/shared"
import { Check, Plus } from "lucide-react"
import NextImage from "next/image"
import React, { useState } from "react"

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

    const getFeedIcon = () => {
        if (feed.title?.toLowerCase().includes("techcrunch")) {
            return "bg-green-600 text-white"
        }
        if (feed.title?.toLowerCase().includes("hacker news")) {
            return "bg-orange-500 text-white"
        }
        return "bg-gradient-to-br from-gray-600 to-gray-700 text-white"
    }

    const getFeedInitials = () => {
        if (feed.title?.toLowerCase().includes("techcrunch")) {
            return "TC"
        }
        if (feed.title?.toLowerCase().includes("hacker news")) {
            return "Y"
        }
        return feed.title ? feed.title.charAt(0).toUpperCase() : "F"
    }

    return (
        <div className="px-2 md:px-4 w-full border-b border-border/40 last:border-0 py-4">
            <div className="flex gap-3 md:gap-4 w-full min-w-0">
                <div className="relative flex-shrink-0">
                    {feed.image_url && (
                        <NextImage
                            src={feed.image_url}
                            alt={feed.title || "Feed icon"}
                            className="w-8 h-8 md:w-9 md:h-9 rounded object-cover"
                            width={36}
                            height={36}
                            onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.style.display = "none"
                                const fallback =
                                    target.nextElementSibling as HTMLElement
                                if (fallback) fallback.style.display = "flex"
                            }}
                        />
                    )}
                    <div
                        className={`w-8 h-8 md:w-9 md:h-9 rounded flex items-center justify-center font-bold text-xs md:text-sm ${getFeedIcon()}`}
                        style={{ display: feed.image_url ? "none" : "flex" }}
                    >
                        {getFeedInitials()}
                    </div>
                </div>

                <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-lg text-black dark:text-foreground leading-tight tracking-tight truncate">
                                {feed.title || "Untitled Publication"}
                            </h3>
                            <a
                                href={feed.link || feed.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-[#BDC6B7] dark:text-secondary truncated"
                            >
                                {(feed.link || feed.url)
                                    ?.replace(/^https?:\/\//, "")
                                    ?.replace(/^www\./, "")
                                    .replace(/\/$/, "") || "Unknown source"}
                            </a>
                        </div>

                        <div className="flex-shrink-0">
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
                        </div>
                    </div>

                    {feed.description && (
                        <p
                            className="text-xs text-[#91998C] mt-2 leading-relaxed break-words"
                            style={{
                                wordWrap: "break-word",
                                overflowWrap: "anywhere",
                                display: "-webkit-box",
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                            }}
                        >
                            {feed.description}
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}
