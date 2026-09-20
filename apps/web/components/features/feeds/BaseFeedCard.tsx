import { Button } from "@/components/ui/button"
import {
    useIsSubscribed,
    type FeedSummary,
    type FeedCategory,
    CATEGORY_DISPLAY_NAMES,
    CONTENT_TYPE_DISPLAY_NAMES,
} from "@readspace/shared"
import { cn } from "@/lib/utils"
import { Trash2 } from "lucide-react"
import Link from "next/link"
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
    /** Custom actions to show in the footer (e.g., 'More like this' link) */
    footerActions?: React.ReactNode
    /** Callback when a tag is clicked to filter/search */
    onTagClick?: (tag: string) => void
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
    footerActions,
    onTagClick,
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

    // Only show native tags if not empty... else fallback to general tags
    const displayTags =
        feed.tags_native && feed.tags_native.length > 0
            ? feed.tags_native
            : feed.tags && feed.tags.length > 0
              ? feed.tags
              : []

    const createTagUrl = (cleanTag: string) => {
        if (typeof window !== "undefined") {
            const url = new URL(window.location.href)
            url.pathname = "/discover"
            url.searchParams.set("q", cleanTag)
            return `${url.pathname}?${url.searchParams.toString()}`
        }
        return `/discover?q=${encodeURIComponent(cleanTag)}`
    }

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
                <a
                    href={`/feeds/${feed.id}/articles`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 hover:opacity-80 transition-opacity mt-0.5"
                >
                    <FeedIcon feed={feed} className="w-8 h-8 md:w-9 md:h-9" />
                </a>

                {/* Feed Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <a
                                    href={`/feeds/${feed.id}/articles`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block hover:opacity-80 transition-opacity"
                                >
                                    <h3 className="font-semibold text-base md:text-lg text-foreground dark:text-foreground leading-snug tracking-tight">
                                        {feed.title || "Untitled Feed"}
                                    </h3>
                                </a>
                                {feed.content_type &&
                                    CONTENT_TYPE_DISPLAY_NAMES[
                                        feed.content_type
                                    ] && (
                                        <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium bg-[#F3F9EF] text-[#6A994E] dark:bg-primary/10 dark:text-primary">
                                            {
                                                CONTENT_TYPE_DISPLAY_NAMES[
                                                    feed.content_type
                                                ]
                                            }
                                        </span>
                                    )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                                <a
                                    href={feed.link || feed.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-foreground truncate transition-colors"
                                >
                                    {(feed.link || feed.url)
                                        ?.replace(/^https?:\/\//, "")
                                        ?.replace(/^www\./, "")
                                        .replace(/\/$/, "") || "No URL"}
                                </a>
                                {feed.author && (
                                    <>
                                        <span className="opacity-40">•</span>
                                        <span className="truncate">
                                            By {feed.author}
                                        </span>
                                    </>
                                )}
                                {feed.top_level_category &&
                                    CATEGORY_DISPLAY_NAMES[
                                        feed.top_level_category as FeedCategory
                                    ] && (
                                        <>
                                            <span className="opacity-40">
                                                •
                                            </span>
                                            <span>
                                                {
                                                    CATEGORY_DISPLAY_NAMES[
                                                        feed.top_level_category as FeedCategory
                                                    ]
                                                }
                                            </span>
                                        </>
                                    )}
                            </div>
                        </div>

                        {/* Header Actions (Follow button + custom actions) */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {headerActions}
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
                        </div>
                    </div>

                    {/* Description */}
                    {feed.description && (
                        <p
                            className={cn(
                                "text-xs md:text-sm mt-1.5 leading-relaxed break-words",
                                isPreview
                                    ? "text-muted-foreground"
                                    : "text-[#737C6F] dark:text-muted-foreground"
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

                    {/* Tags & Footer Actions */}
                    {(displayTags.length > 0 || footerActions) && (
                        <div className="flex items-center justify-between gap-3 flex-wrap mt-2.5">
                            {displayTags.length > 0 ? (
                                <div className="flex items-center gap-2 flex-wrap">
                                    {displayTags.slice(0, 3).map((tag, idx) => {
                                        const cleanTag = tag.replace(/^#/, "")
                                        return (
                                            <Link
                                                key={idx}
                                                href={createTagUrl(cleanTag)}
                                                onClick={(e) => {
                                                    if (onTagClick) {
                                                        e.preventDefault()
                                                        onTagClick(cleanTag)
                                                        window.scrollTo({
                                                            top: 0,
                                                            behavior: "smooth",
                                                        })
                                                    }
                                                }}
                                                className="font-mono text-xs text-muted-foreground/75 hover:text-foreground hover:underline underline-offset-4 transition-colors cursor-pointer"
                                            >
                                                #{cleanTag}
                                            </Link>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div />
                            )}

                            {footerActions && (
                                <div className="ml-auto flex items-center shrink-0">
                                    {footerActions}
                                </div>
                            )}
                        </div>
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
