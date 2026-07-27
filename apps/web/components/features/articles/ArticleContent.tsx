import { useRef, useState, useMemo, useEffect } from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import { type Article, ContentView } from "@readspace/shared"
import { Skeleton } from "@/components/ui/skeleton"
import { useTheme } from "next-themes"

import { AiSummaryCard } from "./AiSummaryCard"
import { AnimatedContent } from "./AnimatedContent"
import { ArticleHeader } from "./ArticleHeader"
import { ArticleToolbar } from "./ArticleToolbar"
import { ProseContainer } from "./ProseContainer"
import { useArticleAI } from "./hooks/use-article-ai"
import { useArticleInteractions } from "./hooks/use-article-interactions"
import { useArticleReading } from "./hooks/use-article-reading"

import { Maximize2, Minimize2, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { formatDistanceToNow, parseISO } from "date-fns"

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

function NewsletterIframe({
    content,
    isDark,
}: {
    content: string
    isDark: boolean
}) {
    const iframeRef = useRef<HTMLIFrameElement>(null)

    useEffect(() => {
        const iframe = iframeRef.current
        if (!iframe) return

        let observer: ResizeObserver | null = null

        const setupObserver = () => {
            try {
                const doc =
                    iframe.contentDocument ||
                    (iframe.contentWindow
                        ? iframe.contentWindow.document
                        : null)
                if (doc && doc.body) {
                    const updateHeight = () => {
                        const height = Math.max(
                            doc.body.scrollHeight,
                            doc.body.offsetHeight,
                            doc.documentElement.scrollHeight,
                            doc.documentElement.offsetHeight
                        )
                        if (height > 0) {
                            iframe.style.height = `${height}px`
                        }
                    }

                    // Initial height set
                    updateHeight()

                    if (window.ResizeObserver) {
                        if (observer) {
                            observer.disconnect()
                        }
                        observer = new ResizeObserver(updateHeight)
                        observer.observe(doc.body)
                    }
                }
            } catch (e) {
                console.error("Failed to setup resize observer", e)
            }
        }

        iframe.addEventListener("load", setupObserver)
        setupObserver()

        return () => {
            if (observer) {
                observer.disconnect()
            }
            iframe.removeEventListener("load", setupObserver)
        }
    }, [content, isDark])

    const srcDoc = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              html, body {
                margin: 0;
                padding: 16px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                background-color: transparent;
                color: ${isDark ? "#e2e8f0" : "#1a202c"};
              }

              html, body, .document, [class*="document"], [class*="body"] {
                height: auto !important;
                min-height: auto !important;
                overflow: visible !important;
              }

              ${
                  isDark
                      ? `
                html {
                  filter: invert(1) hue-rotate(180deg);
                  background-color: #ededed !important; /* Inverts to #121212 */
                }
                
                img, video, svg, .no-invert {
                  filter: invert(1) hue-rotate(180deg) !important;
                }
              `
                      : ""
              }

              img {
                max-width: 100% !important;
                height: auto !important;
              }
              table {
                max-width: 100% !important;
                width: 100% !important;
              }

              /* Prevent email internal dark styles from causing double-inversion grey looks */
              @media (prefers-color-scheme: dark) {
                body, p, td, tr, .body, table, h1, h2, h3, h4, h5, h6, div, span, .document, [class*="document"], [class*="body"] {
                  background-color: #FEFEFE !important;
                  color: #010101 !important;
                }
              }
            </style>
          </head>
          <body>
            <div id="mail-content-root" style="display: flow-root;">
              ${content}
            </div>
          </body>
        </html>
    `

    return (
        <iframe
            ref={iframeRef}
            srcDoc={srcDoc}
            className="newsletter-iframe w-full"
            sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            scrolling="no"
            loading="lazy"
            style={{
                width: "100%",
                border: "none",
                background: "transparent",
                overflow: "hidden",
                minHeight: "500px",
            }}
        />
    )
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

    const publishedAtString = article.published_at
    const readAtString = article.read_at

    const publishedAtDisplay = publishedAtString
        ? isRecentlyReadMode && readAtString
            ? `Read ${formatDistanceToNow(parseISO(readAtString), { addSuffix: true })}`
            : formatDistanceToNow(parseISO(publishedAtString), {
                  addSuffix: true,
              })
        : "Date unknown"

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
    }, [isZenMode, scrollRatio, displayContent])

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

    const activeTab =
        isLoading || isExtracting ? ContentView.Extracted : contentView

    const toolbar = (
        <ArticleToolbar
            hideBackground={true}
            article={article}
            contentView={activeTab}
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
            isPreviewMode={shouldShowPreviewBanner}
        />
    )

    return (
        <div className="flex-1 overflow-hidden flex flex-col h-full relative group/zen">
            {/* Zen Mode Trigger Button - Absolutely positioned in top-right */}
            {!isLoading && displayContent && (
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
                                {article.link?.startsWith("newsletter://") ? (
                                    <NewsletterIframe
                                        content={displayContent}
                                        isDark={isDark}
                                    />
                                ) : (
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
                                )}
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
                                <div className="flex flex-col items-center justify-center py-12 text-center not-prose">
                                    <div className="mx-auto max-w-xs">
                                        <p className="text-sm text-muted-foreground/60">
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
                            <ProseContainer>
                                <ArticleHeader
                                    article={article}
                                    currentReadTime={clientReadTime}
                                    shouldShowFeedBadge={shouldShowFeedBadge}
                                    isMobile={!!isMobile}
                                    isRecentlyReadMode={isRecentlyReadMode}
                                    shouldShowPreviewBanner={
                                        shouldShowPreviewBanner
                                    }
                                    toolbar={null}
                                />

                                {displayContent ? (
                                    article.link?.startsWith(
                                        "newsletter://"
                                    ) ? (
                                        <NewsletterIframe
                                            content={displayContent}
                                            isDark={isDark}
                                        />
                                    ) : (
                                        <div
                                            className="text-xl leading-relaxed mt-8"
                                            style={{
                                                fontFamily:
                                                    "var(--font-garamond-serif), var(--font-noto-serif-sc), var(--font-noto-serif-jp), var(--font-noto-serif-tc)",
                                            }}
                                        >
                                            <div
                                                dangerouslySetInnerHTML={{
                                                    __html:
                                                        displayContent || "",
                                                }}
                                            />
                                        </div>
                                    )
                                ) : (
                                    <div className="space-y-6 mt-8">
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
                                        <div className="flex flex-col items-center justify-center py-12 text-center not-prose">
                                            <div className="mx-auto max-w-xs">
                                                <p className="text-sm text-muted-foreground/60">
                                                    This article doesn&apos;t
                                                    have any content available.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </ProseContainer>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
