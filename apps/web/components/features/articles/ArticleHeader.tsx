import { ArticleToolbar } from "./ArticleToolbar"
import { type Article } from "@readspace/shared"
import { formatDistanceToNow, parseISO } from "date-fns"
import Image from "next/image"
import Link from "next/link"
import { useState } from "react"

interface ArticleHeaderProps {
    article: Article
    currentReadTime: number | null
    isRecentlyReadMode: boolean
    shouldShowFeedBadge: boolean
    shouldShowPreviewBanner: boolean
    isMobile: boolean
    optimisticReadLater: boolean
    contentSource: "original" | "extracted" | "translated"
    translatedContent: string | null
    translatedLanguage: string | null
    onContentSourceChange: (
        source: "original" | "extracted" | "translated"
    ) => void
    onToggleReadLater: () => void
    onMarkAsRead: () => void
    onExtractFullText: () => Promise<void>
    onSummarize: () => Promise<void>
    onTranslate: (lang: string) => Promise<void>
    isExtracting: boolean
    isSummarizing: boolean
    isTranslating: boolean
    onBack?: () => void
    isReadLaterMode: boolean
}

export function ArticleHeader({
    article,
    currentReadTime,
    isRecentlyReadMode,
    shouldShowFeedBadge,
    shouldShowPreviewBanner,
    isMobile,
    optimisticReadLater,
    contentSource,
    translatedContent,
    translatedLanguage,
    onContentSourceChange,
    onToggleReadLater,
    onMarkAsRead,
    onExtractFullText,
    onSummarize,
    onTranslate,
    isExtracting,
    isSummarizing,
    isTranslating,
    onBack,
    isReadLaterMode,
}: ArticleHeaderProps) {
    const [feedImageError, setFeedImageError] = useState(false)

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
                <Link
                    href={`/feeds/${article.feed_id}/articles`}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted transition-colors duration-200 group"
                >
                    {article.feed_icon && !feedImageError ? (
                        <Image
                            src={article.feed_icon}
                            alt={article.feed_title || "Feed image"}
                            width={16}
                            height={16}
                            className="h-4 w-4 shrink-0 rounded"
                            onError={() => setFeedImageError(true)}
                        />
                    ) : (
                        <div className="h-4 w-4 shrink-0 rounded bg-primary/20" />
                    )}
                    <span className="text-xs font-medium tracking-wider uppercase text-muted-foreground group-hover:text-foreground transition-colors duration-200">
                        {article.feed_title}
                    </span>
                </Link>
            )}

            <h1 className="text-4xl font-bold leading-tight text-foreground tracking-tight">
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
                            <span className="hidden sm:inline">•</span>
                        </>
                    )}
                    <span className="whitespace-nowrap">
                        {publishedAtDisplay}
                    </span>
                    {currentReadTime && (
                        <>
                            <span className="hidden sm:inline">•</span>
                            <span className="whitespace-nowrap">
                                {currentReadTime} min read
                            </span>
                        </>
                    )}
                </div>

                {/* Desktop Article Toolbar */}
                {!shouldShowPreviewBanner && !isMobile && (
                    <ArticleToolbar
                        article={article}
                        isReadLater={optimisticReadLater}
                        contentSource={contentSource}
                        onContentSourceChange={onContentSourceChange}
                        hasTranslatedContent={!!translatedContent}
                        translatedLanguage={translatedLanguage}
                        onToggleReadLater={onToggleReadLater}
                        onMarkAsRead={onMarkAsRead}
                        onExtractFullText={onExtractFullText}
                        onSummarize={onSummarize}
                        onTranslate={onTranslate}
                        isExtracting={isExtracting}
                        isSummarizing={isSummarizing}
                        isTranslating={isTranslating}
                        onBack={onBack}
                        hideBackground={true}
                        isReadLaterMode={isReadLaterMode}
                    />
                )}
            </div>
        </div>
    )
}
