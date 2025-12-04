import { useRef, useState, useMemo, useEffect } from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import { type Article, ContentView } from "@readspace/shared"
import { Skeleton } from "@/components/ui/skeleton"

import { AiSummaryCard } from "./AiSummaryCard"
import { AnimatedContent } from "./AnimatedContent"
import { ArticleHeader } from "./ArticleHeader"
import { ArticleToolbar } from "./ArticleToolbar"
import { ProseContainer } from "./ProseContainer"
import { useArticleAI } from "./hooks/use-article-ai"
import { useArticleInteractions } from "./hooks/use-article-interactions"
import { useArticleReading } from "./hooks/use-article-reading"

interface ArticleContentProps {
    article: Article
    isRecentlyReadMode: boolean
    isReadLaterMode: boolean
    shouldShowPreviewBanner: boolean
    shouldShowFeedBadge: boolean
    onMarkAsRead?: () => void
    onArticleRemoved?: () => void
    onBack?: () => void
    isLoading?: boolean
}

import { estimateReadingTime } from "@readspace/shared"

export function ArticleContent({
    article,
    isRecentlyReadMode,
    isReadLaterMode,
    shouldShowPreviewBanner,
    shouldShowFeedBadge,
    onMarkAsRead,
    onArticleRemoved,
    onBack,
    isLoading,
}: ArticleContentProps) {
    const contentRef = useRef<HTMLDivElement>(null)
    const isMobile = useIsMobile()

    // Local state for content view
    const [contentView, setContentView] = useState<ContentView>(
        article.extracted_content ? ContentView.Extracted : ContentView.Original
    )

    // Auto-switch to extracted view when content becomes available
    const prevExtractedContentRef = useRef(article.extracted_content)
    useEffect(() => {
        if (article.extracted_content && !prevExtractedContentRef.current) {
            setContentView(ContentView.Extracted)
        }
        prevExtractedContentRef.current = article.extracted_content
    }, [article.extracted_content])

    // Hooks
    const {
        aiSummary,
        displayContent,
        translatedContent,
        translatedLanguage,
        isExtracting,
        isSummarizing,
        isTranslating,
        handleExtractContent,
        handleSummarize,
        handleTranslate,
    } = useArticleAI({
        article,
        contentView,
        setContentView,
    })

    const {
        handleMarkAsRead: markAsReadInteraction,
        handleToggleReadLater,
        handleScrollMarkAsRead,
        handleContentClickMarkAsRead,
        optimisticReadLater,
        optimisticIsRead,
    } = useArticleInteractions({
        article,
        isRecentlyReadMode,
        isReadLaterMode,
        shouldShowPreviewBanner,
        isMobile: !!isMobile,
        onMarkAsRead,
        onArticleRemoved,
    })

    const { handleScroll } = useArticleReading({
        article,
        onMarkAsRead: () =>
            handleScrollMarkAsRead(contentRef.current?.scrollTop || 0),
    })

    // Client-side read time calculation
    const [clientReadTime, setClientReadTime] = useState(0)

    useEffect(() => {
        if (displayContent) {
            setClientReadTime(
                estimateReadingTime(displayContent.replace(/<[^>]*>/g, ""))
            )
        } else if (article.description) {
            setClientReadTime(
                estimateReadingTime(article.description.replace(/<[^>]*>/g, ""))
            )
        }
    }, [displayContent, article.description])

    // Local state for AI summary dismissal
    const [isAiSummaryDismissed, setIsAiSummaryDismissed] = useState(false)

    // Combine scroll handlers
    const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget
        handleScroll(target.scrollTop, target.scrollHeight, target.clientHeight)
        handleScrollMarkAsRead(target.scrollTop)
    }

    // Derive content key for animation
    const contentKey = useMemo(() => {
        if (contentView === ContentView.Translated && translatedLanguage) {
            return `translated-${translatedLanguage}-${article.id}`
        }
        return `${contentView}-${article.id}`
    }, [contentView, article.id, translatedLanguage])

    const toolbar = (
        <ArticleToolbar
            hideBackground={true}
            article={article}
            contentView={contentView}
            setContentView={setContentView}
            handleMarkAsRead={markAsReadInteraction}
            handleToggleReadLater={handleToggleReadLater}
            handleExtractContent={handleExtractContent}
            handleSummarize={async () => {
                setIsAiSummaryDismissed(false)
                if (!aiSummary) {
                    await handleSummarize()
                }
            }}
            handleTranslate={handleTranslate}
            isExtracting={isExtracting}
            isSummarizing={isSummarizing}
            isTranslating={isTranslating}
            onBack={onBack}
            isReadLaterMode={isReadLaterMode}
            translatedContent={translatedContent}
            translatedLanguage={translatedLanguage}
            isSaved={optimisticReadLater}
            isRead={optimisticIsRead}
        />
    )

    return (
        <div className="flex-1 overflow-hidden flex flex-col h-full">
            {/* Mobile Toolbar - Fixed at top */}
            {isMobile && (
                <div className="md:hidden bg-background/95 backdrop-blur-sm border-b px-4 py-3 shrink-0">
                    {toolbar}
                </div>
            )}

            <div
                ref={contentRef}
                className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth"
                style={{ scrollbarGutter: "stable" }}
                onClick={handleContentClickMarkAsRead}
                onScroll={onScroll}
            >
                <div className="mx-auto max-w-4xl px-4 md:px-8">
                    <ProseContainer>
                        <ArticleHeader
                            article={article}
                            currentReadTime={clientReadTime}
                            shouldShowFeedBadge={shouldShowFeedBadge}
                            isMobile={!!isMobile}
                            isRecentlyReadMode={isRecentlyReadMode}
                            shouldShowPreviewBanner={shouldShowPreviewBanner}
                            toolbar={toolbar}
                        />

                        {aiSummary && !isAiSummaryDismissed && (
                            <AiSummaryCard
                                summary={aiSummary}
                                className="mt-4"
                                onDismiss={() => setIsAiSummaryDismissed(true)}
                            />
                        )}

                        {isLoading || isExtracting || isTranslating ? (
                            <div className="space-y-4 mt-8">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-[90%]" />
                                <Skeleton className="h-4 w-[95%]" />
                                <Skeleton className="h-4 w-[80%]" />
                                <Skeleton className="h-4 w-[85%]" />
                                <Skeleton className="h-4 w-[60%]" />
                            </div>
                        ) : displayContent ? (
                            <AnimatedContent
                                contentKey={contentKey}
                                className="mt-8"
                            >
                                <div
                                    className="text-xl leading-relaxed"
                                    style={{
                                        fontFamily:
                                            "var(--font-garamond-serif), var(--font-noto-serif-sc), var(--font-noto-serif-jp), var(--font-noto-serif-tc)",
                                    }}
                                >
                                    <div
                                        dangerouslySetInnerHTML={{
                                            __html: displayContent,
                                        }}
                                    />
                                </div>
                            </AnimatedContent>
                        ) : (
                            <div className="space-y-6 mt-8">
                                {(article.description || article.user_note) && (
                                    <blockquote className="border-l-4 border-primary/30 bg-muted/30 pl-4 italic text-muted-foreground prose prose-sm max-w-none">
                                        <div
                                            dangerouslySetInnerHTML={{
                                                __html:
                                                    article.user_note ||
                                                    article.description ||
                                                    "",
                                            }}
                                        />
                                    </blockquote>
                                )}
                                <div className="flex flex-col items-center justify-center py-8 text-center">
                                    <div className="mx-auto max-w-md">
                                        <p className="text-sm text-muted-foreground">
                                            This article doesn&apos;t have any
                                            content available.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </ProseContainer>
                </div>
            </div>
        </div>
    )
}
