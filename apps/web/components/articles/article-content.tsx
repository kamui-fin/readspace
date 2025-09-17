"use client"

import { FileText, Globe, Lightbulb } from "lucide-react"
import { parseISO, formatDistanceToNow } from "date-fns"
import { useEffect, useRef, useState } from "react"
import { toast } from "react-hot-toast"
import { useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import {
    createTranslationQueryKey,
    fetchTranslation,
    useExtractFullText,
    useSummarizeArticle,
} from "@readspace/shared"
import { useUpdateArticle, type Article } from "@readspace/shared"
import { AiSummaryCard } from "./ai-summary-card"
import { ArticleToolbar } from "./article-toolbar"
import { AnimatedContent } from "./animated-content"

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
}: ArticleContentProps) {
    const contentRef = useRef<HTMLDivElement>(null)
    const [hasMarkedRead, setHasMarkedRead] = useState(false)
    const [aiSummary, setAiSummary] = useState<string | null>(null)

    const queryClient = useQueryClient()
    const updateArticle = useUpdateArticle()
    const extractFullText = useExtractFullText(article.id)
    const summarizeArticle = useSummarizeArticle(article.id)

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
        try {
            const { data } = await extractFullText.refetch()

            if (data && data.success && data.content) {
                onContentChange(data.content, `extracted-${article.id}`)
                onReadTimeChange(data.estimated_read_time_minutes || null)
                toast.success("Full content extracted successfully")
            } else if (data) {
                toast.error(data.error || "Failed to extract content")
            }
        } catch (error) {
            console.error("Extract content failed:", error)
            toast.error("Failed to extract content")
        }
    }

    /**
     * Handles AI summarization of article content
     */
    const handleSummarize = async () => {
        try {
            const { data } = await summarizeArticle.refetch()

            if (data && data.success && data.summary) {
                setAiSummary(data.summary)
                onSummaryChange(data.summary, true)
                toast.success("Summary generated successfully")
            } else if (data) {
                toast.error(data.error || "Failed to generate summary")
            }
        } catch (error) {
            console.error("Summarize article failed:", error)
            toast.error("Failed to generate summary")
        }
    }

    /**
     * Handles translation of article content to target language
     */
    const handleTranslate = async (targetLanguage: string) => {
        try {
            onTranslationChange(true)
            const contentToUse =
                currentContent !== (article.content || "")
                    ? currentContent
                    : undefined

            // Check cache first
            const queryKey = createTranslationQueryKey(
                article.id,
                targetLanguage,
                contentToUse
            )
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
                onContentChange(
                    cachedData.translated_content,
                    `translated-${targetLanguage}-${article.id}-${Date.now()}`
                )
                return
            }

            // Fetch new translation with caching
            const data = await fetchTranslation(
                queryClient,
                article.id,
                targetLanguage,
                contentToUse
            )

            if (data && data.success && data.translated_content) {
                onContentChange(
                    data.translated_content,
                    `translated-${targetLanguage}-${article.id}-${Date.now()}`
                )
                toast.success(`Article translated to ${targetLanguage}`)
            } else if (data) {
                toast.error(data.error || "Failed to translate article")
            }
        } catch (error) {
            console.error("Translate article failed:", error)
            toast.error("Failed to translate article")
        } finally {
            onTranslationChange(false)
        }
    }

    // Reset content when article changes
    useEffect(() => {
        onContentChange(article.content || "", `original-${article.id}`)
        setAiSummary(null)
        onSummaryChange(null, false)
        onReadTimeChange(article.estimated_read_time_minutes)
    }, [
        article.id,
        article.content,
        article.estimated_read_time_minutes,
        onContentChange,
        onReadTimeChange,
        onSummaryChange,
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
            // Mark as read on ANY scroll, not just bottom
            if (el.scrollTop > 0 && !hasMarkedRead && !article.is_read) {
                setHasMarkedRead(true)

                if (onMarkAsRead) {
                    onMarkAsRead()
                } else {
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
        article.article_type,
        article.is_read,
        hasMarkedRead,
        updateArticle,
        isRecentlyReadMode,
        isReadLaterMode,
        onMarkAsRead,
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
        <div className="flex-1 overflow-hidden">
            <div
                ref={contentRef}
                className="h-full overflow-auto scroll-smooth"
                style={{ scrollbarGutter: "stable" }}
            >
                <article className="mx-auto max-w-4xl px-6 py-8 prose prose-slate dark:prose-invert prose-lg">
                    {/* Article Header */}
                    <div className="mb-8 space-y-4 not-prose">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
                        <h1 className="text-3xl font-bold leading-tight text-foreground">
                            {article.title}
                        </h1>
                        {(article.description || article.note) && (
                            <p className="text-lg text-muted-foreground leading-relaxed">
                                {article.note || article.description}
                            </p>
                        )}
                    </div>

                    {/* Article Toolbar */}
                    <ArticleToolbar
                        article={article}
                        isReadLater={article.is_read_later}
                        onToggleReadLater={() => {
                            updateArticle.mutate({
                                articleId: article.id,
                                data: { is_read_later: !article.is_read_later },
                            })
                        }}
                        onExtractFullText={handleExtractContent}
                        onSummarize={handleSummarize}
                        onTranslate={handleTranslate}
                        isExtracting={extractFullText.status === "pending"}
                        isSummarizing={summarizeArticle.status === "pending"}
                        isTranslating={isTranslating}
                    />

                    {/* Content Display */}
                    <div className="mt-8">
                        {isShowingSummary && aiSummary ? (
                            <AiSummaryCard
                                summary={aiSummary}
                                onDismiss={() => onSummaryChange(null, false)}
                            />
                        ) : currentContent ? (
                            <AnimatedContent
                                contentKey={`content-${article.id}`}
                                className="prose-headings:font-semibold prose-headings:text-foreground prose-p:text-foreground prose-p:leading-relaxed prose-li:text-foreground prose-blockquote:border-l-primary prose-blockquote:bg-muted/30 prose-blockquote:py-2 prose-blockquote:px-4 prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-muted prose-pre:border prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg prose-img:shadow-sm"
                            >
                                <div
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
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="mx-auto max-w-md">
                                    <p className="text-muted-foreground">
                                        This article doesn&apos;t have any
                                        content available.
                                    </p>
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
                            <div className="mt-8 p-5 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent border border-primary/20 rounded-xl">
                                <div className="flex items-start gap-4">
                                    <div className="flex-shrink-0">
                                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                                            <Lightbulb className="w-5 h-5 text-primary" />
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-semibold text-foreground mb-1">
                                            Want to read the full article?
                                        </h3>
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            This RSS feed only provides a
                                            preview. Click the{" "}
                                            <FileText className="inline w-4 h-4 mx-1" />{" "}
                                            icon in the toolbar above to extract
                                            the complete content.
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
    )
}
