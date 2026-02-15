import { Button } from "@/components/ui/button"
import { useIsSubscribed, type FeedSummary } from "@readspace/shared"
import { cn } from "@/lib/utils"
import { Trash2 } from "lucide-react"
import { useState } from "react"
import { FeedIcon } from "./FeedIcon"
import { FeedSubscriptionModal } from "./FeedSubscriptionModal"
import { FeedUnsubscribeDialog } from "./FeedUnsubscribeDialog"

interface BaseFeedCardProps {
    /** The feed to display */
    feed:
        | (FeedSummary & { description?: string | null })
        | (FeedSummary & {
              is_preview: true

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

    // Check if this feed is in the user's subscription list
    const feedUrl = feed.url

    const { isSubscribed: isFollowed, subscription: subscribedFeed } =
        useIsSubscribed({
            id: feed.id,
            url: feedUrl,
            initialIsSubscribed: feed.is_subscribed,
        })

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
                <FeedIcon feed={feed} className="w-8 h-8 md:w-9 md:h-9" />

                {/* Feed Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-lg text-foreground dark:text-foreground leading-tight tracking-tight">
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
                feedId={subscribedFeed?.feed.id ?? feed.id}
            />
        </div>
    )
}
