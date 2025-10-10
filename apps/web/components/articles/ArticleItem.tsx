"use client"

import { formatDistanceToNow, parseISO } from "date-fns"
import { Clock, Paperclip } from "lucide-react"
import Image from "next/image"
import { useState } from "react"

import type { Article } from "@readspace/shared"

interface ArticleItemProps {
    /** The article to display */
    article: Article
    /** Whether this item is currently active/selected */
    isActive?: boolean
    /** Whether this is the last item in a group (affects border styling) */
    isLastInGroup?: boolean
    /** Whether in recently read mode */
    isRecentlyReadMode?: boolean
    /** Whether in read later mode */
    isReadLaterMode?: boolean
    /** Index of the article in the list */
    index?: number
    /** Click handler for article selection */
    onClick: () => void
}

/**
 * ArticleItem component renders a single article in the article list.
 * Handles different display modes and article types (feed, clipped).
 */
export function ArticleItem({
    article,
    isActive = false,
    isLastInGroup = false,
    isRecentlyReadMode = false,
    onClick,
}: ArticleItemProps) {
    const [feedImageError, setFeedImageError] = useState(false)
    const [articleImageError, setArticleImageError] = useState(false)

    const publishedAtString = article.published_at
    const readAtString = article.read_at

    const timeDisplay = publishedAtString
        ? isRecentlyReadMode && readAtString
            ? `Read ${formatDistanceToNow(parseISO(readAtString), { addSuffix: true })}`
            : formatDistanceToNow(parseISO(publishedAtString), {
                addSuffix: true,
            })
        : "Date unknown"

    /**
     * Get priority color classes based on article priority
     */
    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case "high":
                return "text-red-700 bg-red-100 border-red-300 dark:text-red-400 dark:bg-red-950 dark:border-red-800"
            case "medium":
                return "text-orange-700 bg-orange-100 border-orange-300 dark:text-orange-400 dark:bg-orange-950 dark:border-orange-800"
            case "low":
                return "text-green-700 bg-green-100 border-green-300 dark:text-green-400 dark:bg-green-950 dark:border-green-800"
            case "default":
            case "clipped":
                return "text-blue-700 bg-blue-100 border-blue-300 dark:text-blue-400 dark:bg-blue-950 dark:border-blue-800"
            default:
                return "text-gray-700 bg-gray-100 border-gray-300 dark:text-gray-400 dark:bg-gray-950 dark:border-gray-800"
        }
    }

    /**
     * Extract domain from URL for display
     */
    const extractDomain = (url: string): string => {
        try {
            return new URL(url).hostname
        } catch {
            return url
        }
    }

    /**
     * Get favicon URL for a domain
     */
    const getFaviconUrl = (url: string): string => {
        try {
            const domain = new URL(url).hostname
            return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`
        } catch {
            return "/placeholders/avatar.png"
        }
    }

    /**
     * Strip HTML tags from text content
     */
    const stripHTML = (html: string): string => {
        if (typeof window === "undefined") {
            // Server-side: simple regex-based HTML stripping
            return html.replace(/<[^>]*>/g, "").replace(/&[^;]+;/g, "")
        }
        // Client-side: use DOMParser
        const parser = new DOMParser()
        const doc = parser.parseFromString(html, "text/html")
        return doc.body.textContent || ""
    }

    // Extract priority for clipped articles
    const priority =
        article.article_type === "clipped" && article.priority
            ? article.priority
            : null

    // Determine display text for content preview
    const displayText = stripHTML(
        article.note || article.description || article.content || ""
    )

    return (
        <div
            className={`h-full mx-0 py-2.5 px-3 ${!isLastInGroup ? "border-b border-border" : ""}
            ${!isActive ? "hover:bg-muted/60 hover:border-l-primary/20 hover:shadow-sm" : ""}
            active:bg-secondary/10
            transition-all duration-200 ease-out cursor-pointer
            ${isActive ? "bg-secondary/5 border-l-2 border-l-secondary shadow-sm" : "border-l-2 border-l-transparent"}
            ${article.is_read ? "opacity-70" : ""}`}
            onClick={onClick}
        >
            <div
                className={`flex gap-3 w-full min-w-0 max-w-full overflow-hidden ${!article.image_url || articleImageError ? "pr-0" : ""}`}
            >
                <div
                    className={`flex-1 space-y-1.5 min-w-0 overflow-hidden ${!article.image_url || articleImageError ? "max-w-full" : "max-w-[calc(100vw-5rem)]"}`}
                >
                    {/* Header with feed info and priority */}
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="flex items-center gap-1 min-w-0 flex-1">
                            {/* Priority badge for clipped articles */}
                            {article.article_type === "clipped" && (
                                <div
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium border flex-shrink-0 ${getPriorityColor(priority || "default")}`}
                                >
                                    <Paperclip className="h-2.5 w-2.5" />
                                    <span className="capitalize">
                                        {priority || "clipped"}
                                    </span>
                                </div>
                            )}

                            {/* Feed favicon */}
                            {(article.feed?.image_url ||
                                (article.article_type === "clipped" &&
                                    article.link)) &&
                                !feedImageError ? (
                                <Image
                                    src={
                                        article.feed?.image_url ||
                                        getFaviconUrl(article.link)
                                    }
                                    alt={article.feed?.title || "Feed image"}
                                    width={12}
                                    height={12}
                                    className="h-3 w-3 shrink-0 rounded"
                                    onError={() => setFeedImageError(true)}
                                />
                            ) : (
                                <div className="h-3 w-3 shrink-0 rounded bg-primary/8" />
                            )}

                            {/* Feed name or domain */}
                            <span className="text-[10px] text-muted-foreground truncate shrink-0 whitespace-nowrap overflow-hidden">
                                {article.article_type === "clipped" &&
                                    article.link
                                    ? extractDomain(article.link)
                                    : article.feed?.title || "Unknown Feed"}
                            </span>

                            {/* Time display with clock icon */}
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                                <Clock className="h-2.5 w-2.5" />
                                <span className="whitespace-nowrap">
                                    {timeDisplay}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Article title */}
                    <h3
                        className={`text-sm font-medium leading-snug line-clamp-2 ${article.is_read
                            ? "text-muted-foreground"
                            : "text-foreground"
                            }`}
                        style={{
                            wordBreak: "break-word",
                            overflowWrap: "break-word",
                            hyphens: "auto",
                        }}
                    >
                        {article.title}
                    </h3>

                    {/* Article description/content preview */}
                    {displayText && (
                        <p
                            className={`text-xs leading-relaxed line-clamp-2 ${article.is_read
                                ? "text-muted-foreground/70"
                                : "text-muted-foreground"
                                }`}
                            style={{
                                wordBreak: "break-word",
                                overflowWrap: "break-word",
                                hyphens: "auto",
                            }}
                        >
                            {displayText}
                        </p>
                    )}
                </div>

                {/* Article image */}
                {article.image_url && !articleImageError && (
                    <div className="flex-shrink-0">
                        <Image
                            src={article.image_url}
                            alt={article.title || "Article image"}
                            width={64}
                            height={64}
                            className="h-16 w-16 rounded-lg object-cover bg-muted"
                            onError={() => setArticleImageError(true)}
                            loading="lazy"
                        />
                    </div>
                )}
            </div>
        </div>
    )
}
