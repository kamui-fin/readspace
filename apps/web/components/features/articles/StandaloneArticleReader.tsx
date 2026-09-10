"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { ArrowLeft } from "lucide-react"
import { useArticle, type Article } from "@readspace/shared"

import { useIsMobile } from "@/hooks/use-mobile"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ArticleReaderBody } from "./ArticleReaderBody"
import { ArticleToolbar } from "./ArticleToolbar"
import { useArticleReader } from "./hooks/use-article-reader"

interface StandaloneArticleReaderProps {
    articleId: string
    /** Summary already in cache (from the list / Codex) to paint instantly while the full
     *  article loads. */
    initialArticle?: Article
}

/**
 * The full-page reader at `/articles/[id]`: one centered column, a slim sticky bar with a
 * back button and the standard `ArticleToolbar`, then the shared `ArticleReaderBody`. It is
 * the split-view reader's Zen Mode promoted to a real, shareable route — no sidebar, no
 * article list. Scrolling the page marks the article read, same as the split view.
 */
export function StandaloneArticleReader({
    articleId,
    initialArticle,
}: StandaloneArticleReaderProps) {
    const router = useRouter()
    const isMobile = useIsMobile()
    const { resolvedTheme } = useTheme()
    const isDark = resolvedTheme === "dark"

    const { data: fullArticle, isFetching } = useArticle(articleId, {
        enabled: !!articleId,
        initialData: initialArticle,
        initialDataUpdatedAt: 0,
        staleTime: 5 * 60 * 1000,
        articleType: initialArticle?.article_type,
    })

    const article = fullArticle || initialArticle
    const isContentLoading =
        isFetching && !article?.content && !article?.extracted_content

    if (!article) {
        return (
            <div className="mx-auto w-full max-w-[46rem] px-4 py-10 md:px-8 lg:max-w-[52rem]">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="mt-8 h-10 w-3/4" />
                <div className="mt-8 space-y-4">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-[92%]" />
                    <Skeleton className="h-4 w-[96%]" />
                    <Skeleton className="h-4 w-[80%]" />
                </div>
            </div>
        )
    }

    return (
        <ReaderInner
            key={article.id}
            article={article}
            isDark={isDark}
            isMobile={!!isMobile}
            isContentLoading={isContentLoading}
            onBack={() => router.back()}
        />
    )
}

function ReaderInner({
    article,
    isDark,
    isMobile,
    isContentLoading,
    onBack,
}: {
    article: Article
    isDark: boolean
    isMobile: boolean
    isContentLoading: boolean
    onBack: () => void
}) {
    const [readingProgress, setReadingProgress] = useState(0)

    const reader = useArticleReader({
        article,
        isRecentlyReadMode: false,
        isReadLaterMode: false,
        shouldShowPreviewBanner: false,
        isMobile,
        isLoading: isContentLoading,
    })

    // Escape key returns to where the reader was opened from
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return
            const active = document.activeElement?.tagName.toLowerCase()
            if (
                active === "input" ||
                active === "textarea" ||
                document.activeElement?.hasAttribute("contenteditable")
            ) {
                return
            }
            onBack()
        }
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [onBack])

    const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
        const maxScroll = scrollHeight - clientHeight
        setReadingProgress(maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0)
        reader.handleScrollMarkAsRead(scrollTop)
    }

    const toolbar = (
        <ArticleToolbar
            hideBackground
            article={article}
            contentView={reader.activeTab}
            setContentView={reader.setContentView}
            handleMarkAsRead={reader.handleMarkAsRead}
            handleToggleReadLater={reader.handleToggleReadLater}
            handleExtractContent={reader.handleExtractContent}
            handleSummarize={async () => {
                reader.resetAiSummaryDismissed()
                if (!reader.aiSummary) {
                    await reader.handleSummarize()
                }
            }}
            handleTranslate={reader.handleTranslate}
            isExtracting={reader.isExtracting}
            isSummarizing={reader.isSummarizing}
            isTranslating={reader.isTranslating}
            isReadLaterMode={false}
            translatedContent={reader.translatedContent}
            translatedLanguage={reader.translatedLanguage}
            isSaved={reader.optimisticReadLater}
            isRead={reader.optimisticIsRead}
        />
    )

    return (
        <div className="relative flex h-[100dvh] flex-col bg-background md:h-[calc(100vh-1rem)] md:rounded-xl md:shadow-sm">
            {/* Reading progress */}
            <div className="absolute inset-x-0 top-0 z-20 h-0.5 bg-muted/20">
                <div
                    className="h-full bg-secondary transition-all duration-75"
                    style={{ width: `${readingProgress}%` }}
                />
            </div>

            {/* Slim top bar */}
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-background/95 px-3 py-2.5 backdrop-blur-sm md:px-4">
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
                    onClick={onBack}
                >
                    <ArrowLeft className="h-4 w-4" />
                    <span className="text-sm">Back</span>
                </Button>
                {toolbar}
            </div>

            {/* Centered reading column */}
            <div
                className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth"
                style={{ scrollbarGutter: "stable" }}
                onClick={reader.handleContentClickMarkAsRead}
                onScroll={onScroll}
            >
                <div className="mx-auto w-full max-w-[46rem] px-4 pb-16 pt-6 md:px-8 md:pb-24 lg:max-w-[52rem]">
                    <ArticleReaderBody
                        article={article}
                        isDark={isDark}
                        displayContent={reader.displayContent}
                        contentKey={reader.contentKey}
                        clientReadTime={reader.clientReadTime}
                        shouldShowFeedBadge
                        isMobile={isMobile}
                        isRecentlyReadMode={false}
                        shouldShowPreviewBanner={false}
                        toolbar={null}
                        aiSummary={reader.aiSummary}
                        onDismissAiSummary={reader.dismissAiSummary}
                        isBusy={reader.isBusy}
                    />
                </div>
            </div>
        </div>
    )
}
