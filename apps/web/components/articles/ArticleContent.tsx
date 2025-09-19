"use client"

import { useQueryClient } from "@tanstack/react-query"
import { formatDistanceToNow, parseISO } from "date-fns"
import { FileText, Globe, Lightbulb } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "react-hot-toast"

import { Button } from "@/components/ui/button"
import {
    createTranslationQueryKey,
    fetchTranslation,
    useExtractFullText,
    useSummarizeArticle,
    useUpdateArticle,
    type Article,
} from "@readspace/shared"
import { RSS_QUERY_KEYS } from "@readspace/shared/src/api/query-keys"
import { AiSummaryCard } from "./AiSummaryCard"
import { AnimatedContent } from "./AnimatedContent"
import { ArticleToolbar } from "./ArticleToolbar"

interface ArticleContentProps {
    /** The article to display */
    article: Article
    /** Current content being displayed (may be translated/summarized) */
    currentContent: string
    /** Current read time estimate */
    currentReadTime: number | null
    /** Whether to show AI summary instead of article content */
    isShowingSummary: boolean
    /** Whether currently translating */
    isTranslating: boolean
    /** Whether in recently read mode */
    isRecentlyReadMode?: boolean
    /** Whether in read later mode */
    isReadLaterMode?: boolean
    /** Whether to show preview banner */
    shouldShowPreviewBanner?: boolean
    /** Callback when content changes */
    onContentChange: (content: string, key: string) => void
    /** Callback when read time changes */
    onReadTimeChange: (readTime: number | null) => void
    /** Callback when summary state changes */
    onSummaryChange: (summary: string | null, isShowing: boolean) => void
    /** Callback when translation starts/ends */
    onTranslationChange: (isTranslating: boolean) => void
    /** Callback when article should be marked as read */
    onMarkAsRead?: () => void
    /** Callback when article is removed from list */
    onArticleRemoved?: () => void
    /** Callback for back navigation (mobile) */
    onBack?: () => void
}

/**
 * ArticleContent component handles the display and interaction with article content,
 * including AI summaries, translations, and content extraction.
 */
export function ArticleContent({
    article,
    currentContent,
    currentReadTime,
    isShowingSummary,
    isTranslating,
    isRecentlyReadMode = false,
    isReadLaterMode = false,
    shouldShowPreviewBanner = false,
    onContentChange,
    onReadTimeChange,
    onSummaryChange,
    onTranslationChange,
    onMarkAsRead,
    onArticleRemoved,
    onBack,
}: ArticleContentProps) {
    const contentRef = useRef<HTMLDivElement>(null)
    const [hasMarkedRead, setHasMarkedRead] = useState(false)
    const [aiSummary, setAiSummary] = useState<string | null>(null)
    const [contentKey, setContentKey] = useState(`original-${article.id}`)
    // Local optimistic state for read later
    const [optimisticReadLater, setOptimisticReadLater] = useState(article.is_read_later)

    const queryClient = useQueryClient()
    const updateArticle = useUpdateArticle()

    // Only create AI hooks when we actually have a valid article ID to prevent unnecessary queries
    const extractFullText = useExtractFullText(article?.id || "skip")
    const summarizeArticle = useSummarizeArticle(article?.id || "skip")

    // Debug logging for AI hooks
    console.log("🔧 ArticleContent Debug:", {
        articleId: article?.id,
        extractHookEnabled: !!article?.id && article?.id !== "skip",
        summarizeHookEnabled: !!article?.id && article?.id !== "skip",
        currentContent: currentContent.substring(0, 100) + "...",
        isShowingSummary,
        aiSummary: aiSummary ? aiSummary.substring(0, 100) + "..." : null,
        aiSummaryType: typeof aiSummary,
        contentKey
    })

    // Debug when aiSummary state changes
    useEffect(() => {
        console.log("🧠 aiSummary state changed:", {
            aiSummary: aiSummary ? aiSummary.substring(0, 100) + "..." : null,
            aiSummaryType: typeof aiSummary,
            length: aiSummary?.length || 0,
            isNull: aiSummary === null,
            isUndefined: aiSummary === undefined
        })
    }, [aiSummary])

    // Sync optimistic state when article changes
    useEffect(() => {
        setOptimisticReadLater(article.is_read_later)
    }, [article.is_read_later])

    const publishedAtString = article.published_at
    const readAtString = article.read_at

    const publishedAtDisplay = publishedAtString
        ? isRecentlyReadMode && readAtString
            ? `Read ${formatDistanceToNow(parseISO(readAtString), { addSuffix: true })}`
            : formatDistanceToNow(parseISO(publishedAtString), {
                addSuffix: true,
            })
        : "Date unknown"

    // Extract priority for clipped articles
    const priority =
        article.article_type === "clipped" && article.priority
            ? article.priority
            : null

    /**
     * Handles extraction of full text content from article URL
     */
    const handleExtractContent = async () => {
        console.log("🚀 Starting content extraction for article:", article.id)

        try {
            console.log("📞 Calling extractFullText.refetch()...")
            const { data } = await extractFullText.refetch()

            console.log("📥 Extract response:", {
                success: data?.success,
                hasContent: !!data?.content,
                contentLength: data?.content?.length || 0,
                readTime: data?.estimated_read_time_minutes,
                error: data?.error
            })

            if (data && data.success && data.content) {
                const newKey = `extracted-${article.id}`
                console.log("✅ Extraction successful, updating content:", {
                    newKey,
                    contentPreview: data.content.substring(0, 200) + "...",
                    readTime: data.estimated_read_time_minutes
                })

                setContentKey(newKey)
                onContentChange(data.content, newKey)
                onReadTimeChange(data.estimated_read_time_minutes || null)
                toast.success("Full content extracted successfully")
            } else if (data) {
                console.log("❌ Extraction failed:", data.error)
                toast.error(data.error || "Failed to extract content")
            }
        } catch (error) {
            console.error("💥 Extract content exception:", error)
            toast.error("Failed to extract content")
        }
    }

    /**
     * Handles AI summarization of article content
     */
    const handleSummarize = async () => {
        console.log("🧠 Starting AI summarization for article:", article.id)

        try {
            console.log("📞 Calling summarizeArticle.refetch()...")
            const { data } = await summarizeArticle.refetch()

            console.log("📥 Summarize response:", {
                success: data?.success,
                hasSummary: !!data?.summary,
                summaryLength: data?.summary?.length || 0,
                error: data?.error
            })

            if (data && data.success && data.summary) {
                console.log("✅ Summarization successful:", {
                    summaryPreview: data.summary.substring(0, 200) + "...",
                    summaryLength: data.summary.length,
                    willShowSummary: true
                })

                console.log("🔄 Calling setAiSummary with:", data.summary.substring(0, 100) + "...")
                setAiSummary(data.summary)

                console.log("🔄 Calling onSummaryChange with:", {
                    summary: data.summary.substring(0, 100) + "...",
                    isShowing: true
                })
                onSummaryChange(data.summary, true)

                toast.success("Summary generated successfully")

                // Log the state immediately after setting (won't show the updated state due to React batching)
                console.log("📊 State update called - React will batch these updates")
            } else if (data) {
                console.log("❌ Summarization failed:", data.error)
                toast.error(data.error || "Failed to generate summary")
            }
        } catch (error) {
            console.error("💥 Summarize article exception:", error)
            toast.error("Failed to generate summary")
        }
    }

    /**
     * Handles translation of article content to target language
     */
    const handleTranslate = async (targetLanguage: string) => {
        console.log("🌐 Starting translation for article:", article.id, "to", targetLanguage)

        try {
            onTranslationChange(true)
            const contentToUse =
                currentContent !== (article.content || "")
                    ? currentContent
                    : undefined

            console.log("📝 Translation content check:", {
                currentContentLength: currentContent.length,
                originalContentLength: (article.content || "").length,
                willUseCustomContent: !!contentToUse,
                customContentPreview: contentToUse?.substring(0, 100) + "..." || "Using original"
            })

            // Check cache first
            const queryKey = createTranslationQueryKey(
                article.id,
                targetLanguage,
                contentToUse
            )
            console.log("🔍 Checking translation cache with key:", queryKey)

            type TranslationCache = {
                success: boolean
                translated_content: string
            }
            const cachedData =
                queryClient.getQueryData<TranslationCache>(queryKey)

            if (
                cachedData &&
                cachedData.success &&
                cachedData.translated_content
            ) {
                console.log("💾 Found cached translation:", {
                    translatedLength: cachedData.translated_content.length,
                    preview: cachedData.translated_content.substring(0, 200) + "..."
                })

                const newKey = `translated-${targetLanguage}-${article.id}`
                setContentKey(newKey)
                onContentChange(cachedData.translated_content, newKey)
                return
            }

            console.log("📞 Fetching new translation...")
            // Fetch new translation with caching
            const data = await fetchTranslation(
                queryClient,
                article.id,
                targetLanguage,
                contentToUse
            )

            console.log("📥 Translation response:", {
                success: data?.success,
                hasTranslatedContent: !!data?.translated_content,
                contentLength: data?.translated_content?.length || 0,
                error: data?.error
            })

            if (data && data.success && data.translated_content) {
                const newKey = `translated-${targetLanguage}-${article.id}`
                console.log("✅ Translation successful:", {
                    newKey,
                    contentPreview: data.translated_content.substring(0, 200) + "..."
                })

                setContentKey(newKey)
                onContentChange(data.translated_content, newKey)
                toast.success(`Article translated to ${targetLanguage}`)
            } else if (data) {
                console.log("❌ Translation failed:", data.error)
                toast.error(data.error || "Failed to translate article")
            }
        } catch (error) {
            console.error("💥 Translation exception:", error)
            toast.error("Failed to translate article")
        } finally {
            onTranslationChange(false)
        }
    }

    // Reset content when article ID changes (not content/read time)
    useEffect(() => {
        console.log("🔄 Article ID changed, resetting content:", {
            articleId: article.id,
            originalContentLength: (article.content || "").length,
            readTime: article.estimated_read_time_minutes
        })

        const originalKey = `original-${article.id}`
        setContentKey(originalKey)
        onContentChange(article.content || "", originalKey)
        setAiSummary(null)
        onSummaryChange(null, false)
        onReadTimeChange(article.estimated_read_time_minutes)
        setHasMarkedRead(false) // Reset read state for new article
        setOptimisticReadLater(article.is_read_later) // Reset optimistic read later state

        console.log("✅ Article reset complete:", {
            newContentKey: originalKey,
            clearedAiSummary: true,
            resetReadState: true
        })
    }, [
        article.id, // Only reset when article ID changes, not content/read time
        // Callbacks removed from deps to prevent unnecessary re-runs
    ])

    // Only enable scroll-based read marking on desktop
    useEffect(() => {
        if (
            isRecentlyReadMode ||
            isReadLaterMode ||
            !contentRef.current ||
            hasMarkedRead ||
            (typeof window !== "undefined" && window.innerWidth < 768) // Disable on mobile
        )
            return
        const el = contentRef.current
        const handleScroll = () => {
            // Mark as read on minimal scroll (just 50px) to be more responsive
            if (el.scrollTop > 50 && !hasMarkedRead && !article.is_read) {
                console.log("Scroll detected - marking as read")
                setHasMarkedRead(true)

                if (onMarkAsRead) {
                    onMarkAsRead()
                } else {
                    // Optimistically update the UI immediately
                    queryClient.setQueriesData(
                        { queryKey: [RSS_QUERY_KEYS.ARTICLES] },
                        (oldData: any) => {
                            if (!oldData?.pages) return oldData;
                            return {
                                ...oldData,
                                pages: oldData.pages.map((page: any) => ({
                                    ...page,
                                    items: page.items?.map((item: any) =>
                                        item.id === article.id
                                            ? { ...item, is_read: true }
                                            : item
                                    ) || []
                                }))
                            };
                        }
                    );

                    updateArticle.mutate({
                        articleId: article.id,
                        data: { is_read: true },
                        articleType: article.article_type,
                    })
                }
            }
        }
        el.addEventListener("scroll", handleScroll)
        return () => el.removeEventListener("scroll", handleScroll)
    }, [
        article.id,
        article.is_read,
        article.article_type,
        hasMarkedRead,
        isRecentlyReadMode,
        isReadLaterMode,
        onMarkAsRead,
        updateArticle,
    ])

    // Handle scroll completion for read later mode
    useEffect(() => {
        if (!isReadLaterMode || !contentRef.current || hasMarkedRead) return
        const el = contentRef.current
        const handleScroll = () => {
            if (el.scrollHeight - el.scrollTop - el.clientHeight <= 1) {
                if (!hasMarkedRead) {
                    // Set optimistic UI update first
                    setHasMarkedRead(true)

                    // Show toast asking about removal from read later
                    toast(
                        (t) => (
                            <div className="flex flex-col gap-2">
                                <span>
                                    Article finished! What would you like to do?
                                </span>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            updateArticle.mutate({
                                                articleId: article.id,
                                                data: {
                                                    is_read: true,
                                                    is_read_later: false,
                                                },
                                                articleType:
                                                    article.article_type,
                                            })
                                            toast.dismiss(t.id)
                                            onArticleRemoved?.()
                                        }}
                                    >
                                        Mark as Read
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            toast.success(
                                                "Article removed from Read Later"
                                            )
                                            updateArticle.mutate({
                                                articleId: article.id,
                                                data: { is_read_later: false },
                                                articleType:
                                                    article.article_type,
                                            })
                                            toast.dismiss(t.id)
                                            onArticleRemoved?.()
                                        }}
                                    >
                                        Remove from Read Later
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => toast.dismiss(t.id)}
                                    >
                                        Keep
                                    </Button>
                                </div>
                            </div>
                        ),
                        { duration: 0 }
                    )
                }
            }
        }
        el.addEventListener("scroll", handleScroll)
        return () => el.removeEventListener("scroll", handleScroll)
    }, [
        article.id,
        article.article_type,
        hasMarkedRead,
        updateArticle,
        isReadLaterMode,
        onArticleRemoved,
    ])

    return (
        <div className="flex-1 overflow-hidden flex flex-col h-full">
            {/* Mobile Toolbar - Fixed at top */}
            {(typeof window !== "undefined" && window.innerWidth < 768) && (
                <div className="md:hidden bg-background/95 backdrop-blur-sm border-b px-4 py-3 flex-shrink-0">
                    <ArticleToolbar
                        article={article}
                        isReadLater={optimisticReadLater}
                        onToggleReadLater={() => {
                            const newReadLaterState = !optimisticReadLater
                            setOptimisticReadLater(newReadLaterState)

                            // Show toast immediately for instant feedback
                            toast.success(
                                newReadLaterState
                                    ? "Article saved to Read Later"
                                    : "Article removed from Read Later"
                            )

                            updateArticle.mutate(
                                {
                                    articleId: article.id,
                                    data: { is_read_later: newReadLaterState },
                                    articleType: article.article_type,
                                },
                                {
                                    onError: () => {
                                        // Revert optimistic update on error and show error
                                        setOptimisticReadLater(!newReadLaterState)
                                        toast.error("Failed to update article. Please try again.")
                                    },
                                }
                            )
                        }}
                        onExtractFullText={handleExtractContent}
                        onSummarize={handleSummarize}
                        onTranslate={handleTranslate}
                        isExtracting={extractFullText.isFetching}
                        isSummarizing={summarizeArticle.isFetching}
                        isTranslating={isTranslating}
                        onBack={onBack}
                        hideBackground={true}
                    />
                </div>
            )}

            <div
                ref={contentRef}
                className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth"
                style={{ scrollbarGutter: "stable" }}
                onClick={() => {
                    // Mark as read on content click (desktop only, not in preview or read modes)
                    if (
                        !isRecentlyReadMode &&
                        !isReadLaterMode &&
                        !article.is_read &&
                        (typeof window !== "undefined" && window.innerWidth >= 768) // Desktop only
                    ) {
                        if (onMarkAsRead) {
                            onMarkAsRead()
                        } else {
                            // Optimistically update the UI immediately
                            queryClient.setQueriesData(
                                { queryKey: [RSS_QUERY_KEYS.ARTICLES] },
                                (oldData: any) => {
                                    if (!oldData?.pages) return oldData;
                                    return {
                                        ...oldData,
                                        pages: oldData.pages.map((page: any) => ({
                                            ...page,
                                            items: page.items?.map((item: any) =>
                                                item.id === article.id
                                                    ? { ...item, is_read: true }
                                                    : item
                                            ) || []
                                        }))
                                    };
                                }
                            );

                            updateArticle.mutate({
                                articleId: article.id,
                                data: { is_read: true },
                                articleType: article.article_type,
                            })
                        }
                    }
                }}
            >
                <div className="mx-auto max-w-4xl">
                    <article className="px-6 py-8 prose prose-slate dark:prose-invert prose-2xl article-content">
                        {/* Article Header */}
                        <div className="mb-8 space-y-6 not-prose">
                            <h1 className="text-4xl font-bold leading-tight text-foreground tracking-tight">
                                {article.title}
                            </h1>

                            {/* Article Meta */}
                            <div className="flex items-center justify-between border-b border-border pb-6">
                                <div className="flex items-center gap-3 text-sm text-muted-foreground font-mono">
                                    {article.author && (
                                        <>
                                            <span className="text-foreground font-medium">
                                                {article.author}
                                            </span>
                                            <span>•</span>
                                        </>
                                    )}
                                    <span>{publishedAtDisplay}</span>
                                    {currentReadTime && (
                                        <>
                                            <span>•</span>
                                            <span>{currentReadTime} min read</span>
                                        </>
                                    )}
                                    {priority && (
                                        <>
                                            <span>•</span>
                                            <span className="capitalize">
                                                {priority} priority
                                            </span>
                                        </>
                                    )}
                                </div>

                                {/* Desktop Article Toolbar */}
                                {!shouldShowPreviewBanner && (typeof window !== "undefined" && window.innerWidth >= 768) && (
                                    <ArticleToolbar
                                        article={article}
                                        isReadLater={optimisticReadLater}
                                        onToggleReadLater={() => {
                                            const newReadLaterState = !optimisticReadLater
                                            setOptimisticReadLater(newReadLaterState)

                                            // Show toast immediately for instant feedback
                                            toast.success(
                                                newReadLaterState
                                                    ? "Article saved to Read Later"
                                                    : "Article removed from Read Later"
                                            )

                                            updateArticle.mutate(
                                                {
                                                    articleId: article.id,
                                                    data: { is_read_later: newReadLaterState },
                                                    articleType: article.article_type,
                                                },
                                                {
                                                    onError: () => {
                                                        // Revert optimistic update on error and show error
                                                        setOptimisticReadLater(!newReadLaterState)
                                                        toast.error("Failed to update article. Please try again.")
                                                    },
                                                }
                                            )
                                        }}
                                        onExtractFullText={handleExtractContent}
                                        onSummarize={handleSummarize}
                                        onTranslate={handleTranslate}
                                        isExtracting={extractFullText.isFetching}
                                        isSummarizing={summarizeArticle.isFetching}
                                        isTranslating={isTranslating}
                                        onBack={onBack}
                                        hideBackground={true}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Content Display */}
                        <div className="mt-8">
                            {(() => {
                                const hasValidSummary = aiSummary !== null && aiSummary !== undefined && aiSummary.length > 0;
                                const shouldShowSummary = (isShowingSummary || hasValidSummary) && hasValidSummary;
                                console.log("🎨 Rendering decision:", {
                                    shouldShowSummary,
                                    isShowingSummary,
                                    hasValidSummary,
                                    aiSummaryType: typeof aiSummary,
                                    aiSummaryValue: aiSummary,
                                    hasCurrentContent: !!currentContent,
                                    currentContentLength: currentContent.length,
                                    renderChoice: shouldShowSummary ? "AI_SUMMARY_WITH_CONTENT" : currentContent ? "CONTENT_ONLY" : "FALLBACK"
                                });
                                return null;
                            })()}

                            {/* AI Summary - Show when available */}
                            {(() => {
                                const hasValidSummary = aiSummary !== null && aiSummary !== undefined && aiSummary.length > 0;
                                return (isShowingSummary || hasValidSummary) && hasValidSummary;
                            })() && (
                                    <div className="mb-8">
                                        <AiSummaryCard
                                            summary={aiSummary!}
                                            onDismiss={() => {
                                                console.log("❌ Dismissing AI summary")
                                                setAiSummary(null)
                                                onSummaryChange(null, false)
                                            }}
                                        />
                                    </div>
                                )}

                            {/* Article Content - Always show if available */}
                            {currentContent ? (
                                <AnimatedContent
                                    contentKey={contentKey}
                                    className="prose-headings:font-semibold prose-headings:text-foreground prose-p:text-foreground prose-p:leading-relaxed prose-p:text-xl prose-li:text-foreground prose-li:text-xl prose-blockquote:border-l-primary prose-blockquote:bg-muted/30 prose-blockquote:py-3 prose-blockquote:px-4 prose-blockquote:text-xl prose-code:bg-muted prose-code:px-1.5 prose-code:py-1 prose-code:rounded prose-code:text-lg prose-code:before:content-none prose-code:after:content-none prose-pre:bg-muted prose-pre:border prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg prose-img:shadow-sm prose-strong:text-foreground"
                                >
                                    <div
                                        className="text-xl leading-relaxed"
                                        style={{
                                            fontFamily:
                                                "var(--font-garamond-serif), var(--font-noto-serif-sc), var(--font-noto-serif-jp), var(--font-noto-serif-tc)",
                                        }}
                                        dangerouslySetInnerHTML={{
                                            __html: currentContent,
                                        }}
                                    />
                                </AnimatedContent>
                            ) : (
                                <div className="space-y-6">
                                    {(article.description || article.note) && (
                                        <blockquote
                                            className="border-l-4 border-primary/30 bg-muted/30 pl-4 py-3 italic text-muted-foreground prose prose-sm max-w-none"
                                            dangerouslySetInnerHTML={{
                                                __html: article.note || article.description || "",
                                            }}
                                        />
                                    )}
                                    <div className="flex flex-col items-center justify-center py-8 text-center">
                                        <div className="mx-auto max-w-md">
                                            <p className="text-muted-foreground">
                                                This article doesn&apos;t have any
                                                content available.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Content extraction suggestion - show when content is too short */}
                        {article.link &&
                            !shouldShowPreviewBanner &&
                            (currentContent.length <= 500 ||
                                (!currentContent &&
                                    (article.note || article.description))) && (
                                <div className="mt-6 px-6 py-0 bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <Lightbulb className="w-4 h-4 text-primary flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-foreground">
                                                <span className="font-medium">Want the full article?</span>{" "}
                                                <span className="text-muted-foreground">
                                                    Click <FileText className="inline w-3.5 h-3.5 mx-0.5" /> in the toolbar to extract complete content.
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                        {/* Visit Website button at the bottom */}
                        {article.link && (
                            <div className="flex justify-center mt-8 pt-6 pb-4 border-t">
                                <Button
                                    variant="outline"
                                    size="lg"
                                    onClick={() =>
                                        window.open(
                                            article.link,
                                            "_blank",
                                            "noopener,noreferrer"
                                        )
                                    }
                                    className="inline-flex items-center gap-2 transition-all duration-200 hover:shadow-md hover:bg-muted/20"
                                >
                                    <Globe className="h-4 w-4 transition-transform duration-200 hover:rotate-12" />
                                    Visit Website
                                </Button>
                            </div>
                        )}
                    </article>
                </div>
            </div>
        </div>
    )
}
