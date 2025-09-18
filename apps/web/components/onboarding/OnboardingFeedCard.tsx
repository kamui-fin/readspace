import { Button } from "@/components/ui/button"
import { useRefreshFeed, useSubscribeToFeed } from "@readspace/shared"
import { Check, Plus } from "lucide-react"
import NextImage from "next/image"
import { useState } from "react"

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
}

export function OnboardingFeedCard({
    feed,
    onSubscribed,
}: OnboardingFeedCardProps) {
    const [isSubscribed, setIsSubscribed] = useState(false)
    const subscribeToFeed = useSubscribeToFeed()
    const refreshFeed = useRefreshFeed()

    const truncateText = (text: string, maxLength: number) => {
        if (text.length <= maxLength) return text
        return text.substring(0, maxLength) + "..."
    }

    const handleSubscribe = async () => {
        if (isSubscribed) return

        // Immediately update UI for instant feedback
        setIsSubscribed(true)
        onSubscribed?.(feed.id)

        try {
            // Subscribe to feed with default folder (backend will handle creating default folder)
            await subscribeToFeed.mutateAsync({
                feedId: feed.id,
                folderId: "default", // Backend will handle this
            })

            // Trigger background refresh - user doesn't need to wait
            refreshFeed.mutate({
                feedId: feed.id,
                forceRefetch: true,
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
        <div className="group relative rounded-xl p-4 transition-all duration-200">
            <div className="flex items-start gap-4">
                <div className="relative flex-shrink-0">
                    {feed.image_url ? (
                        <NextImage
                            src={feed.image_url}
                            alt={feed.title || "Feed icon"}
                            className="w-12 h-12 rounded-xl object-cover"
                            width={48}
                            height={48}
                            onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.style.display = "none"
                                const fallback =
                                    target.nextElementSibling as HTMLElement
                                if (fallback) fallback.style.display = "flex"
                            }}
                        />
                    ) : null}
                    <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center font-semibold text-sm ${getFeedIcon()}`}
                        style={{ display: feed.image_url ? "none" : "flex" }}
                    >
                        {getFeedInitials()}
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                        <h3 className="font-semibold text-card-foreground leading-snug">
                            {feed.title || "Untitled Publication"}
                        </h3>

                        <Button
                            onClick={handleSubscribe}
                            disabled={isSubscribed}
                            className={`h-8 px-3 text-xs font-medium flex items-center gap-1.5 flex-shrink-0 transition-colors ${isSubscribed
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

                    <div className="text-xs text-muted-foreground mb-1">
                        {(feed.link || feed.url)
                            ?.replace(/^https?:\/\//, "")
                            .replace(/\/$/, "") || "Unknown source"}
                    </div>

                    {feed.description && (
                        <p className="text-sm text-muted-foreground/80 leading-relaxed line-clamp-2">
                            {truncateText(feed.description, 120)}
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}
