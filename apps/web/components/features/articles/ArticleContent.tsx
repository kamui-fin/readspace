import { useRef, useState, useEffect } from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import type { Article } from "@readspace/shared"
import { useTheme } from "next-themes"

import { ArticleReaderBody } from "./ArticleReaderBody"
import { ArticleToolbar } from "./ArticleToolbar"
import { useArticleReader } from "./hooks/use-article-reader"
import { useArticleReading } from "./hooks/use-article-reading"

import { Maximize2, Minimize2 } from "lucide-react"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

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
    const { resolvedTheme } = useTheme()
    const isDark = resolvedTheme === "dark"

    // Zen Mode States
    const [isZenMode, setIsZenMode] = useState(false)
    const [scrollRatio, setScrollRatio] = useState(0)
    const [readingProgress, setReadingProgress] = useState(0)
    const zenScrollRef = useRef<HTMLDivElement>(null)

    const reader = useArticleReader({
        article,
        isRecentlyReadMode,
        isReadLaterMode,
        shouldShowPreviewBanner,
        isMobile: !!isMobile,
        onMarkAsRead,
        onArticleRemoved,
        isLoading,
    })

    const { handleScroll } = useArticleReading({
        article,
        onMarkAsRead: () =>
            reader.handleScrollMarkAsRead(contentRef.current?.scrollTop || 0),
    })

    const handleEnterZenMode = () => {
        if (contentRef.current) {
            const maxScroll =
                contentRef.current.scrollHeight -
                contentRef.current.clientHeight
            const percentage =
                maxScroll > 0 ? contentRef.current.scrollTop / maxScroll : 0
            setScrollRatio(percentage)
        }
        setIsZenMode(true)
    }

    const handleExitZenMode = () => {
        if (zenScrollRef.current) {
            const maxScroll =
                zenScrollRef.current.scrollHeight -
                zenScrollRef.current.clientHeight
            const ratio =
                maxScroll > 0 ? zenScrollRef.current.scrollTop / maxScroll : 0
            setIsZenMode(false)

            // Scroll original reader container back to the same relative position
            setTimeout(() => {
                if (contentRef.current) {
                    const originalMaxScroll =
                        contentRef.current.scrollHeight -
                        contentRef.current.clientHeight
                    contentRef.current.scrollTop = ratio * originalMaxScroll
                }
            }, 50)
        } else {
            setIsZenMode(false)
        }
    }

    // Body scroll lock
    useEffect(() => {
        if (isZenMode) {
            document.body.style.overflow = "hidden"
        } else {
            document.body.style.overflow = ""
        }
        return () => {
            document.body.style.overflow = ""
        }
    }, [isZenMode])

    // Keybindings: 'Z' to enter, 'Escape' to exit
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isZenMode) {
                handleExitZenMode()
            }

            if (e.key.toLowerCase() === "z" && !isZenMode) {
                const active = document.activeElement?.tagName.toLowerCase()
                if (
                    active !== "input" &&
                    active !== "textarea" &&
                    !document.activeElement?.hasAttribute("contenteditable")
                ) {
                    e.preventDefault()
                    handleEnterZenMode()
                }
            }
        }
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [isZenMode, scrollRatio])

    // Restore scroll position in Zen Mode when entering
    useEffect(() => {
        if (isZenMode && zenScrollRef.current) {
            const timer = setTimeout(() => {
                if (zenScrollRef.current) {
                    const maxScroll =
                        zenScrollRef.current.scrollHeight -
                        zenScrollRef.current.clientHeight
                    zenScrollRef.current.scrollTop = scrollRatio * maxScroll
                }
            }, 50)
            return () => clearTimeout(timer)
        }
    }, [isZenMode, scrollRatio, reader.displayContent])

    const handleZenScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const scrollTop = e.currentTarget.scrollTop
        const scrollHeight = e.currentTarget.scrollHeight
        const clientHeight = e.currentTarget.clientHeight

        const maxScroll = scrollHeight - clientHeight
        if (maxScroll > 0) {
            setReadingProgress((scrollTop / maxScroll) * 100)
        } else {
            setReadingProgress(0)
        }
    }

    // Combine scroll handlers
    const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget
        handleScroll(target.scrollTop, target.scrollHeight, target.clientHeight)
        reader.handleScrollMarkAsRead(target.scrollTop)
    }

    const toolbar = (
        <ArticleToolbar
            hideBackground={true}
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
            handleToggleHighlights={reader.handleToggleHighlights}
            isHighlighting={reader.isHighlighting}
            highlightsEnabled={reader.highlightsEnabled}
            isExtracting={reader.isExtracting}
            isSummarizing={reader.isSummarizing}
            isTranslating={reader.isTranslating}
            onBack={onBack}
            isReadLaterMode={isReadLaterMode}
            translatedContent={reader.translatedContent}
            translatedLanguage={reader.translatedLanguage}
            isSaved={reader.optimisticReadLater}
            isRead={reader.optimisticIsRead}
            isPreviewMode={shouldShowPreviewBanner}
        />
    )

    return (
        <div className="flex-1 overflow-hidden flex flex-col h-full relative group/zen">
            {/* Zen Mode Trigger Button - Absolutely positioned in top-right */}
            {!isLoading && reader.displayContent && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                className="absolute top-4 right-4 md:top-6 md:right-6 z-20 h-9 w-9 p-0 rounded-full flex items-center justify-center bg-background/85 hover:bg-accent hover:text-accent-foreground border border-border/40 shadow-sm backdrop-blur-sm transition-all duration-300 hover:scale-115 active:scale-95 cursor-pointer md:opacity-0 md:group-hover/zen:opacity-100 transition-opacity"
                                onClick={handleEnterZenMode}
                            >
                                <Maximize2 className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent align="end">
                            Enter Zen Mode{" "}
                            <kbd className="ml-1.5 px-1 py-0.5 text-[9px] bg-muted border border-border rounded font-mono text-muted-foreground font-semibold">
                                Z
                            </kbd>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
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
                onClick={reader.handleContentClickMarkAsRead}
                onScroll={onScroll}
            >
                <div className="mx-auto max-w-4xl px-4 md:px-8">
                    <ArticleReaderBody
                        article={reader.displayArticle}
                        isDark={isDark}
                        displayContent={reader.displayContent}
                        highlightsEnabled={reader.highlightsEnabled}
                        contentKey={reader.contentKey}
                        clientReadTime={reader.clientReadTime}
                        shouldShowFeedBadge={shouldShowFeedBadge}
                        isMobile={!!isMobile}
                        isRecentlyReadMode={isRecentlyReadMode}
                        shouldShowPreviewBanner={shouldShowPreviewBanner}
                        toolbar={toolbar}
                        aiSummary={reader.aiSummary}
                        onDismissAiSummary={reader.dismissAiSummary}
                        isBusy={reader.isBusy}
                        isTranslating={reader.isTranslating}
                    />
                </div>
            </div>

            {/* Zen Mode Overlay */}
            {isZenMode && (
                <div className="fixed inset-0 z-[1200] flex flex-col bg-background text-foreground transition-colors duration-300 overflow-hidden select-text">
                    {/* Top Reading Progress Bar */}
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-muted/20 z-50">
                        <div
                            className="h-full bg-primary transition-all duration-75"
                            style={{ width: `${readingProgress}%` }}
                        />
                    </div>

                    {/* Minimalist Exit Icon in Top-Right */}
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    className="absolute top-4 right-4 md:top-6 md:right-6 z-50 h-9 w-9 p-0 rounded-full flex items-center justify-center bg-background/85 hover:bg-accent hover:text-accent-foreground border border-border/40 shadow-sm backdrop-blur-sm transition-all duration-300 hover:scale-115 active:scale-95 cursor-pointer"
                                    onClick={handleExitZenMode}
                                >
                                    <Minimize2 className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent align="end">
                                Exit Zen Mode{" "}
                                <kbd className="ml-1.5 px-1 py-0.5 text-[9px] bg-muted border border-border rounded font-mono text-muted-foreground font-semibold">
                                    Esc
                                </kbd>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    {/* Reading Canvas */}
                    <div
                        ref={zenScrollRef}
                        className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth"
                        style={{ scrollbarGutter: "stable" }}
                        onScroll={handleZenScroll}
                    >
                        <div className="mx-auto max-w-4xl px-4 md:px-8 pt-4 pb-16 md:pt-6 md:pb-24">
                            <ArticleReaderBody
                                article={reader.displayArticle}
                                isDark={isDark}
                                displayContent={reader.displayContent}
                                highlightsEnabled={reader.highlightsEnabled}
                                contentKey={reader.contentKey}
                                clientReadTime={reader.clientReadTime}
                                shouldShowFeedBadge={shouldShowFeedBadge}
                                isMobile={!!isMobile}
                                isRecentlyReadMode={isRecentlyReadMode}
                                shouldShowPreviewBanner={
                                    shouldShowPreviewBanner
                                }
                                toolbar={null}
                                isBusy={reader.isBusy}
                                isTranslating={reader.isTranslating}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
