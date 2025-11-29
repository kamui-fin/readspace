import { Button } from "@/components/ui/button"
import { cn, useFeeds, type FeedSummary } from "@readspace/shared"
import { Trash2 } from "lucide-react"
import NextImage from "next/image"
import { useState } from "react"
import { FeedSubscriptionModal } from "./FeedSubscriptionModal"
import { FeedUnsubscribeDialog } from "./FeedUnsubscribeDialog"

interface BaseFeedCardProps {
    /** The feed to display */
    feed:
    | (FeedSummary & { description?: string | null })
    | (FeedSummary & {
        is_preview: true
        preview_url: string
        description?: string | null
    })
    /** Variant for styling */
    variant?: "default" | "preview"
    /** Additional className */
    className?: string
    /** Custom actions to show in the header (e.g., dropdown menu) */
    headerActions?: React.ReactNode
    /** Whether to show follow/unfollow button */
    showFollowButton?: boolean
}

/**
 * Base feed card component with shared logic for displaying and managing feeds.
 *
 * This component handles:
 * - Feed display (image, title, description, link)
 * - Follow/unfollow state management with URL normalization
 * - Subscription modal handling
 * - Unsubscribe modal handling
 *
 * Used by both FeedCard (default variant) and FeedPreviewCard (preview variant).
 */
export function BaseFeedCard({
    feed,
    variant = "default",
    className,
    headerActions,
    showFollowButton = true,
}: BaseFeedCardProps) {
    const [isSubscribeModalOpen, setIsSubscribeModalOpen] = useState(false)
    const [isUnsubscribeModalOpen, setIsUnsubscribeModalOpen] = useState(false)

    // Get the user's subscribed feeds to check if this feed is subscribed
    const { data: feedsData } = useFeeds(
        {},
        {
            refetchOnMount: false,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            staleTime: 10 * 60 * 1000, // 10 minutes
            gcTime: 15 * 60 * 1000, // 15 minutes
            refetchInterval: false,
        }
    )

    // Normalize URL function to handle www/non-www variations
    const normalizeUrl = (url: string) => {
        return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")
    }

    // Check if this feed is in the user's subscription list
    const isPreviewFeed = "is_preview" in feed && feed.is_preview === true
    const feedUrl = isPreviewFeed ? feed.url : feed.url

    // For preview feeds, compare by normalized RSS URL
    // For regular feeds, compare by ID first, then fall back to URL comparison
    const subscribedFeed = feedsData?.find((f) => {
        if (!isPreviewFeed) {
            // Regular feed: check by ID
            return f.id === feed.id
        }
        // Preview feed: check by normalized URL
        return normalizeUrl(f.feed.url) === normalizeUrl(feedUrl)
    })

    const isFollowed = !!subscribedFeed

    const truncateText = (text: string, maxLength: number) => {
        if (text.length <= maxLength) return text
        return text.substring(0, maxLength) + "..."
    }

    const handleFollowClick = () => {
        if (isFollowed) {
            setIsUnsubscribeModalOpen(true)
        } else {
            setIsSubscribeModalOpen(true)
        }
    }

    const isPreview = variant === "preview"

    return (
        <div
            className={cn(
                "w-full",
                isPreview &&
                "p-4 border-2 border-dashed border-primary bg-primary/5 dark:bg-primary/10 rounded-lg",
                className
            )}
        >
            <div className="flex gap-3 md:gap-4 w-full min-w-0">
                {/* Feed Icon */}
                <div className="relative flex-shrink-0">
                    {feed.image_url && (
                        <NextImage
                            src={feed.image_url}
                            alt={feed.title || "Feed icon"}
                            className="w-8 h-8 md:w-9 md:h-9 rounded object-cover"
                            width={36}
                            height={36}
                            onError={(
                                e: React.SyntheticEvent<HTMLImageElement, Event>
                            ) => {
                                const target = e.target as HTMLImageElement
                                target.style.display = "none"
                                const fallback =
                                    target.nextElementSibling as HTMLElement
                                if (fallback) fallback.style.display = "flex"
                            }}
                        />
                    )}
                    <div
                        className={`w-8 h-8 md:w-9 md:h-9 rounded flex items-center justify-center text-white font-bold text-xs md:text-sm ${feed.title?.toLowerCase().includes("techcrunch")
                            ? "bg-green-600"
                            : feed.title
                                ?.toLowerCase()
                                .includes("hacker news")
                                ? "bg-orange-500"
                                : "bg-gray-600"
                            }`}
                        style={{ display: feed.image_url ? "none" : "flex" }}
                    >
                        {feed.title?.toLowerCase().includes("techcrunch")
                            ? "TC"
                            : feed.title?.toLowerCase().includes("hacker news")
                                ? "Y"
                                : feed.title
                                    ? feed.title.charAt(0).toUpperCase()
                                    : "F"}
                    </div>
                </div>

                {/* Feed Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-lg text-black dark:text-foreground leading-tight tracking-tight">
                                {feed.title || "Untitled Feed"}
                            </h3>
                            <a
                                href={feed.link || feed.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-[#BDC6B7] dark:text-secondary truncate block mt-0.5"
                            >
                                {(feed.link || feed.url)
                                    ?.replace(/^https?:\/\//, "")
                                    ?.replace(/^www\./, "")
                                    .replace(/\/$/, "") || "No URL"}
                            </a>
                        </div>

                        {/* Header Actions (Follow button + custom actions) */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {showFollowButton && (
                                <Button
                                    variant={
                                        isFollowed
                                            ? "outline"
                                            : isPreview
                                                ? "default"
                                                : "secondary"
                                    }
                                    onClick={handleFollowClick}
                                    className={cn(
                                        "h-8 text-xs",
                                        isFollowed
                                            ? "text-destructive hover:text-destructive border-destructive/20 hover:bg-destructive/10"
                                            : isPreview &&
                                            "bg-primary hover:bg-primary/90 text-primary-foreground"
                                    )}
                                >
                                    {isFollowed && (
                                        <Trash2 className="mr-1 h-3 w-3" />
                                    )}
                                    {isFollowed ? "Unfollow" : "Follow"}
                                </Button>
                            )}
                            {headerActions}
                        </div>
                    </div>

                    {/* Description */}
                    {feed.description && (
                        <p
                            className={cn(
                                "text-xs mt-2 leading-relaxed break-words",
                                isPreview
                                    ? "text-muted-foreground"
                                    : "text-[#91998C]"
                            )}
                            style={{
                                wordWrap: "break-word",
                                overflowWrap: "anywhere",
                                display: "-webkit-box",
                                WebkitLineClamp: isPreview ? 2 : 3,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                            }}
                        >
                            {isPreview && feed.description.length > 120
                                ? truncateText(feed.description, 120)
                                : feed.description}
                        </p>
                    )}
                </div>
            </div>

            <FeedSubscriptionModal
                isOpen={isSubscribeModalOpen}
                onClose={() => setIsSubscribeModalOpen(false)}
                feed={feed}
            />

            <FeedUnsubscribeDialog
                isOpen={isUnsubscribeModalOpen}
                onClose={() => setIsUnsubscribeModalOpen(false)}
                feed={feed}
                subscriptionId={subscribedFeed?.id}
            />
        </div>
    )
}
