import type { Article } from "@readspace/shared"
import { formatDistanceToNow, parseISO } from "date-fns"
import { FeedIcon } from "@/components/features/feeds/FeedIcon"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { useState } from "react"

interface ArticleHeaderProps {
    article: Article
    currentReadTime: number | null
    shouldShowFeedBadge: boolean
    isMobile: boolean
    isRecentlyReadMode: boolean
    shouldShowPreviewBanner: boolean
    toolbar?: React.ReactNode
}

function toTitleCase(str: string) {
    return str.replace(
        /\b\w/g,
        (match) => match.toUpperCase()
    )
}

export function ArticleHeader({
    article,
    currentReadTime,
    shouldShowFeedBadge,
    isMobile,
    isRecentlyReadMode,
    shouldShowPreviewBanner,
    toolbar,
}: ArticleHeaderProps) {


    const publishedAtString = article.published_at
    const readAtString = article.read_at

    const publishedAtDisplay = publishedAtString
        ? isRecentlyReadMode && readAtString
            ? `Read ${formatDistanceToNow(parseISO(readAtString), { addSuffix: true })}`
            : formatDistanceToNow(parseISO(publishedAtString), {
                addSuffix: true,
            })
        : "Date unknown"

    return (
        <div className="space-y-4 not-prose">
            {/* Feed Link Badge - Show when not in feed-specific view */}
            {shouldShowFeedBadge && (
                <div className="flex items-center gap-2 flex-wrap">
                    <Link
                        href={`/feeds/${article.feed_id}/articles`}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted transition-colors duration-200 group"
                    >
                        <FeedIcon
                            feed={{
                                title: article.feed_title,
                                image_url: article.feed_icon,
                            }}
                            className="h-4 w-4 shrink-0 rounded"
                        />
                        <span className="text-xs font-medium tracking-wider uppercase text-muted-foreground group-hover:text-foreground transition-colors duration-200 truncate max-w-[200px]">
                            {article.feed_title}
                        </span>
                    </Link>
                    {article.tags && article.tags.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                            {article.tags.slice(0, 5).map((tag) => (
                                <Badge
                                    key={tag}
                                    variant="accent"
                                    className="text-xs font-mono font-medium px-3 py-1"
                                >
                                    {tag.toLowerCase()}
                                </Badge>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <h1 className="text-4xl font-bold leading-tight text-foreground leading-tight tracking-tight">
                {article.title}
            </h1>

            {/* Article Meta */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border pb-6 gap-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground font-mono">
                    {article.author && (
                        <>
                            <span className="text-foreground font-medium wrap-break-word">
                                {article.author}
                            </span>
                            <span className="hidden sm:inline">/</span>
                        </>
                    )}
                    <span className="whitespace-nowrap">
                        {publishedAtDisplay}
                    </span>
                    {currentReadTime && (
                        <>
                            <span className="hidden sm:inline">/</span>
                            <span className="whitespace-nowrap">
                                {currentReadTime} min read
                            </span>
                        </>
                    )}
                </div>

                {/* Desktop Article Toolbar */}
                {!shouldShowPreviewBanner && !isMobile && toolbar}
            </div>
        </div>
    )
}
