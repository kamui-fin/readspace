"use client"

import { useEffect, useRef } from "react"

import { AnimatedContent } from "./AnimatedContent"
import { ArticleHeader } from "./ArticleHeader"
import { ArticleToolbar } from "./ArticleToolbar"
import { useArticleContext } from "./ArticleContext"
import { useIsMobile } from "@/hooks/use-mobile"

export function ArticleContent() {
    const contentRef = useRef<HTMLDivElement>(null)
    const isMobile = useIsMobile()

    const {
        article,
        contentSource,
        setContentSource,
        handleMarkAsRead,
        handleToggleReadLater,
        handleScrollMarkAsRead,
        handleContentClickMarkAsRead,
        handleExtractContent,
        handleSummarize,
        handleTranslate,
        extractFullText,
        summarizeArticle,
        isTranslating,
        onBack,
        isReadLaterMode,
        optimisticReadLater,
        contentKey,
        translatedContent,
        translatedLanguage,
        // State from context
        currentContent,
        currentReadTime,
        isShowingSummary,
        setCurrentReadTime,
        shouldShowFeedBadge,
    } = useArticleContext()

    // Update read time when article changes
    useEffect(() => {
        setCurrentReadTime(article.estimated_read_time_minutes)
    }, [article.id, article.estimated_read_time_minutes, setCurrentReadTime])

    // Scroll tracking for marking as read
    useEffect(() => {
        const el = contentRef.current
        if (!el) return

        const handleScroll = () => {
            handleScrollMarkAsRead(el.scrollTop)
        }

        el.addEventListener("scroll", handleScroll)
        return () => el.removeEventListener("scroll", handleScroll)
    }, [handleScrollMarkAsRead])

    return (
        <div className="flex-1 overflow-hidden flex flex-col h-full">
            {/* Mobile Toolbar - Fixed at top */}
            {isMobile && (
                <div className="md:hidden bg-background/95 backdrop-blur-sm border-b px-4 py-3 shrink-0">
                    <ArticleToolbar
                        hideBackground={true}
                    />
                </div>
            )}

            <div
                ref={contentRef}
                className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth"
                style={{ scrollbarGutter: "stable" }}
                onClick={handleContentClickMarkAsRead}
            >
                <div className="mx-auto max-w-4xl">
                    <article className="px-6 py-8 prose prose-slate dark:prose-invert prose-2xl article-content prose-headings:font-semibold prose-headings:text-foreground prose-p:text-foreground prose-p:leading-relaxed prose-p:text-xl prose-li:text-foreground prose-li:text-xl prose-blockquote:border-l-primary prose-blockquote:bg-muted/30 prose-blockquote:py-3 prose-blockquote:px-4 prose-blockquote:text-xl prose-code:bg-muted prose-code:px-1.5 prose-code:py-1 prose-code:rounded prose-code:text-lg prose-code:before:content-none prose-code:after:content-none prose-pre:bg-muted prose-pre:border prose-pre:text-foreground prose-a:text-primary prose-a:no-underline prose-a:hover:underline prose-img:rounded-lg prose-img:shadow-sm prose-strong:text-foreground prose-em:text-foreground prose-figcaption:text-muted-foreground prose-figcaption:text-sm prose-figcaption:italic prose-figure:my-8 prose-hr:border-border prose-th:text-foreground prose-th:font-semibold prose-th:border-border prose-td:text-foreground prose-td:border-border prose-table:border-border prose-thead:border-border prose-tr:border-border prose-ol:text-foreground prose-ul:text-foreground prose-dl:text-foreground prose-dt:text-foreground prose-dt:font-semibold prose-dd:text-foreground prose-lead:text-muted-foreground prose-video:rounded-lg prose-video:shadow-sm prose-kbd:bg-muted prose-kbd:text-foreground prose-kbd:px-2 prose-kbd:py-1 prose-kbd:rounded prose-kbd:border prose-kbd:border-border">
                        <ArticleHeader
                            currentReadTime={currentReadTime}
                            shouldShowFeedBadge={shouldShowFeedBadge}
                            isMobile={!!isMobile}
                        />
                        {(() => {
                            const displayContent =
                                contentSource === "translated"
                                    ? translatedContent
                                    : contentSource === "extracted"
                                        ? article.extracted_content
                                        : article.content ||
                                        article.description ||
                                        ""

                            return displayContent ? (
                                <AnimatedContent
                                    contentKey={contentKey}
                                    className=""
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
                                <div className="space-y-6">
                                    {(article.description ||
                                        article.user_note) && (
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
                                                This article doesn&apos;t have
                                                any content available.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )
                        })()}
                    </article>
                </div>
            </div>
        </div>
    )
}
