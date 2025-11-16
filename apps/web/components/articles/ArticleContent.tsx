"use client"

import { useQueryClient } from "@tanstack/react-query"
import { formatDistanceToNow, parseISO } from "date-fns"
import { Globe } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
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

// Type for the paginated articles data structure from TanStack Query
interface ArticlesPageData {
    items: Article[]
    total: number
    page: number
    has_more: boolean
}

interface ArticlesInfiniteData {
    pages: ArticlesPageData[]
    pageParams: unknown[]
}

interface UnreadCountsData {
    total_unread: number
    read_later_count: number
    [key: string]: number
}

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
    currentContent, // eslint-disable-line @typescript-eslint/no-unused-vars
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
    const [optimisticReadLater, setOptimisticReadLater] = useState(
        article.is_read_later
    )
    // Content source selection ('original', 'extracted', or 'translated')
    const [contentSource, setContentSource] = useState<
        "original" | "extracted" | "translated"
    >(article.extracted_content ? "extracted" : "original")
    // Store translated content and language
    const [translatedContent, setTranslatedContent] = useState<string | null>(
        null
    )
    const [translatedLanguage, setTranslatedLanguage] = useState<string | null>(
        null
    )
    const [feedImageError, setFeedImageError] = useState(false)

    const queryClient = useQueryClient()
    const updateArticle = useUpdateArticle()
    const pathname = usePathname()

    // Check if we're viewing a specific feed's articles page
    const isInFeedView = pathname?.startsWith("/feeds/") && pathname?.includes("/articles")

    // For AI operations (summary, translation), always use the base content (original or extracted)
    // This ensures proper cache key generation based on source content hash, not translated content
    // Note: Display content is computed inline in the render section based on contentSource
    const baseContentForAI =
        contentSource === "extracted" && article.extracted_content
            ? article.extracted_content
            : article.content || article.description || ""

    // Only create AI hooks when we actually have a valid article ID to prevent unnecessary queries
    // Pass article URL to extraction hook for proper cache key generation
    const extractFullText = useExtractFullText(
        article?.id || "skip",
        article?.link || undefined
    )
    const summarizeArticle = useSummarizeArticle(
        article?.id || "skip",
        baseContentForAI
    )

    // Sync optimistic state when article changes
    useEffect(() => {
        setOptimisticReadLater(article.is_read_later)
    }, [article.is_read_later])

    // Reset content source when article changes
    useEffect(() => {
        setContentSource(article.extracted_content ? "extracted" : "original")
        setTranslatedContent(null)
        setTranslatedLanguage(null)
        setFeedImageError(false)
    }, [article.id, article.extracted_content])

    const publishedAtString = article.published_at
    const readAtString = article.read_at

    const publishedAtDisplay = publishedAtString
        ? isRecentlyReadMode && readAtString
            ? `Read ${formatDistanceToNow(parseISO(readAtString), { addSuffix: true })}`
            : formatDistanceToNow(parseISO(publishedAtString), {
                  addSuffix: true,
              })
        : "Date unknown"

    // Show feed badge when not in a feed-specific view and article has feed info
    const shouldShowFeedBadge = !isInFeedView && article.feed_id && article.feed?.title


    /**
     * Handles extraction of full text content from article URL
     */
    const handleExtractContent = async () => {
        try {
            const { data } = await extractFullText.refetch()

            if (data && data.success && data.content) {
                const newKey = `extracted-${article.id}`
                setContentKey(newKey)
                onContentChange(data.content, newKey)
                onReadTimeChange(data.estimated_read_time_minutes || null)

                // Update the article cache with extracted content
                queryClient.setQueryData(
                    [RSS_QUERY_KEYS.ARTICLE, article.id],
                    (old: Article | undefined) => {
                        if (!old) return old
                        return {
                            ...old,
                            extracted_content: data.content,
                            estimated_read_time_minutes:
                                data.estimated_read_time_minutes || old.estimated_read_time_minutes,
                        }
                    }
                )

                // Automatically switch to extracted content after successful extraction
                setContentSource("extracted")
            } else if (data) {
                toast.error(data.error || "Failed to extract content")
            }
        } catch (error) {
            console.error("Extract content error:", error)
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
            console.error("Summarize article error:", error)
            toast.error("Failed to generate summary")
        }
    }

    /**
     * Handles translation of article content to target language
     */
    const handleTranslate = async (targetLanguage: string) => {
        try {
            onTranslationChange(true)
            // Use the active content based on content source (but not translated content)
            const contentToUse =
                contentSource === "extracted" && article.extracted_content
                    ? article.extracted_content
                    : article.content || article.description || ""

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
                const newKey = `translated-${targetLanguage}-${article.id}`
                setContentKey(newKey)
                setTranslatedContent(cachedData.translated_content)
                setTranslatedLanguage(targetLanguage)
                onContentChange(cachedData.translated_content, newKey)
                // Switch to translated tab
                setContentSource("translated")
                toast.success(`Article translated successfully`)
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
                const newKey = `translated-${targetLanguage}-${article.id}`
                setContentKey(newKey)
                setTranslatedContent(data.translated_content)
                setTranslatedLanguage(targetLanguage)
                onContentChange(data.translated_content, newKey)
                // Switch to translated tab
                setContentSource("translated")
                toast.success(`Article translated successfully`)
            } else if (data) {
                toast.error(data.error || "Failed to translate article")
            }
        } catch (error) {
            console.error("Translation error:", error)
            toast.error("Failed to translate article")
        } finally {
            onTranslationChange(false)
        }
    }

    // Reset content when article ID changes (not content/read time)
    useEffect(() => {
        const originalKey = `original-${article.id}`
        setContentKey(originalKey)
        onContentChange(article.content || "", originalKey)
        setAiSummary(null)
        onSummaryChange(null, false)
        onReadTimeChange(article.estimated_read_time_minutes)
        setHasMarkedRead(false) // Reset read state for new article
        setOptimisticReadLater(article.is_read_later) // Reset optimistic read later state
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [article.id])

    // Only enable scroll-based read marking on desktop
    useEffect(() => {
        if (
            isRecentlyReadMode ||
            isReadLaterMode ||
            shouldShowPreviewBanner ||
            !contentRef.current ||
            hasMarkedRead ||
            (typeof window !== "undefined" && window.innerWidth < 768) // Disable on mobile
        )
            return
        const el = contentRef.current
        const handleScroll = () => {
            // Mark as read on minimal scroll (just 50px) to be more responsive
            if (el.scrollTop > 50 && !hasMarkedRead && !article.is_read) {
                setHasMarkedRead(true)

                if (onMarkAsRead) {
                    onMarkAsRead()
                } else {
                    // Optimistically update the UI immediately
                    queryClient.setQueriesData(
                        { queryKey: [RSS_QUERY_KEYS.ARTICLES] },
                        (oldData: ArticlesInfiniteData | undefined) => {
                            if (!oldData?.pages) return oldData
                            return {
                                ...oldData,
                                pages: oldData.pages.map(
                                    (page: ArticlesPageData) => ({
                                        ...page,
                                        items:
                                            page.items?.map((item: Article) =>
                                                item.id === article.id
                                                    ? { ...item, is_read: true }
                                                    : item
                                            ) || [],
                                    })
                                ),
                            }
                        }
                    )

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
        shouldShowPreviewBanner,
        onMarkAsRead,
        updateArticle,
        queryClient,
    ])

    return (
        <div className="flex-1 overflow-hidden flex flex-col h-full">
            {/* Mobile Toolbar - Fixed at top */}
            {typeof window !== "undefined" && window.innerWidth < 768 && (
                <div className="md:hidden bg-background/95 backdrop-blur-sm border-b px-4 py-3 flex-shrink-0">
                    <ArticleToolbar
                        article={article}
                        isReadLater={optimisticReadLater}
                        contentSource={contentSource}
                        onContentSourceChange={setContentSource}
                        hasTranslatedContent={!!translatedContent}
                        translatedLanguage={translatedLanguage}
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
                                    data: {
                                        is_read_later: newReadLaterState,
                                        // When saving for later, mark as unread to update sidebar count
                                        is_read: newReadLaterState
                                            ? false
                                            : article.is_read,
                                    },
                                    articleType: article.article_type,
                                },
                                {
                                    onError: () => {
                                        // Revert optimistic update on error and show error
                                        setOptimisticReadLater(
                                            !newReadLaterState
                                        )
                                        toast.error(
                                            "Failed to update article. Please try again."
                                        )
                                    },
                                }
                            )
                        }}
                        onMarkAsRead={() => {
                            // Mark as read and remove from read later instantly
                            setOptimisticReadLater(false)
                            toast.success("Article marked as read")

                            // Optimistically update the articles cache to instantly remove from read-later list
                            queryClient.setQueriesData(
                                { queryKey: [RSS_QUERY_KEYS.ARTICLES] },
                                (oldData: ArticlesInfiniteData | undefined) => {
                                    if (!oldData?.pages) return oldData
                                    return {
                                        ...oldData,
                                        pages: oldData.pages.map(
                                            (page: ArticlesPageData) => ({
                                                ...page,
                                                items:
                                                    page.items
                                                        ?.filter(
                                                            (item: Article) =>
                                                                // In read-later mode, remove this article entirely
                                                                isReadLaterMode
                                                                    ? item.id !==
                                                                      article.id
                                                                    : true
                                                        )
                                                        .map((item: Article) =>
                                                            item.id ===
                                                            article.id
                                                                ? {
                                                                      ...item,
                                                                      is_read: true,
                                                                      is_read_later: false,
                                                                  }
                                                                : item
                                                        ) || [],
                                            })
                                        ),
                                    }
                                }
                            )

                            // Also update unread counts optimistically
                            queryClient.setQueryData(
                                [RSS_QUERY_KEYS.UNREAD_COUNTS],
                                (oldData: UnreadCountsData | undefined) => {
                                    if (!oldData) return oldData
                                    return {
                                        ...oldData,
                                        read_later_count: Math.max(
                                            0,
                                            (oldData.read_later_count || 0) - 1
                                        ),
                                    }
                                }
                            )

                            // Immediately remove from list UI
                            onArticleRemoved?.()

                            updateArticle.mutate(
                                {
                                    articleId: article.id,
                                    data: {
                                        is_read: true,
                                        is_read_later: false,
                                    },
                                    articleType: article.article_type,
                                },
                                {
                                    onError: () => {
                                        // Revert optimistic update on error
                                        setOptimisticReadLater(true)
                                        toast.error(
                                            "Failed to mark article as read. Please try again."
                                        )

                                        // Revert cache optimistic updates
                                        queryClient.invalidateQueries({
                                            queryKey: [RSS_QUERY_KEYS.ARTICLES],
                                        })
                                        queryClient.invalidateQueries({
                                            queryKey: [
                                                RSS_QUERY_KEYS.UNREAD_COUNTS,
                                            ],
                                        })
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
                        isReadLaterMode={isReadLaterMode}
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
                        !shouldShowPreviewBanner &&
                        !article.is_read &&
                        typeof window !== "undefined" &&
                        window.innerWidth >= 768 // Desktop only
                    ) {
                        if (onMarkAsRead) {
                            onMarkAsRead()
                        } else {
                            // Optimistically update the UI immediately
                            queryClient.setQueriesData(
                                { queryKey: [RSS_QUERY_KEYS.ARTICLES] },
                                (oldData: ArticlesInfiniteData | undefined) => {
                                    if (!oldData?.pages) return oldData
                                    return {
                                        ...oldData,
                                        pages: oldData.pages.map(
                                            (page: ArticlesPageData) => ({
                                                ...page,
                                                items:
                                                    page.items?.map(
                                                        (item: Article) =>
                                                            item.id ===
                                                            article.id
                                                                ? {
                                                                      ...item,
                                                                      is_read: true,
                                                                  }
                                                                : item
                                                    ) || [],
                                            })
                                        ),
                                    }
                                }
                            )

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
                    <article className="px-6 py-8 prose prose-slate dark:prose-invert prose-2xl article-content prose-headings:font-semibold prose-headings:text-foreground prose-p:text-foreground prose-p:leading-relaxed prose-p:text-xl prose-li:text-foreground prose-li:text-xl prose-blockquote:border-l-primary prose-blockquote:bg-muted/30 prose-blockquote:py-3 prose-blockquote:px-4 prose-blockquote:text-xl prose-code:bg-muted prose-code:px-1.5 prose-code:py-1 prose-code:rounded prose-code:text-lg prose-code:before:content-none prose-code:after:content-none prose-pre:bg-muted prose-pre:border prose-pre:text-foreground prose-a:text-primary prose-a:no-underline prose-a:hover:underline prose-img:rounded-lg prose-img:shadow-sm prose-strong:text-foreground prose-em:text-foreground prose-figcaption:text-muted-foreground prose-figcaption:text-sm prose-figcaption:italic prose-figure:my-8 prose-hr:border-border prose-th:text-foreground prose-th:font-semibold prose-th:border-border prose-td:text-foreground prose-td:border-border prose-table:border-border prose-thead:border-border prose-tr:border-border prose-ol:text-foreground prose-ul:text-foreground prose-dl:text-foreground prose-dt:text-foreground prose-dt:font-semibold prose-dd:text-foreground prose-lead:text-muted-foreground prose-video:rounded-lg prose-video:shadow-sm prose-kbd:bg-muted prose-kbd:text-foreground prose-kbd:px-2 prose-kbd:py-1 prose-kbd:rounded prose-kbd:border prose-kbd:border-border">
                        {/* Article Header */}
                        <div className="space-y-4 not-prose">
                            {/* Feed Link Badge - Show when not in feed-specific view */}
                            {shouldShowFeedBadge && article.feed && (
                                <Link
                                    href={`/feeds/${article.feed_id}/articles`}
                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted transition-colors duration-200 group"
                                >
                                    {article.feed.image_url && !feedImageError ? (
                                        <Image
                                            src={article.feed.image_url}
                                            alt={article.feed.title || "Feed image"}
                                            width={16}
                                            height={16}
                                            className="h-4 w-4 shrink-0 rounded"
                                            onError={() => setFeedImageError(true)}
                                        />
                                    ) : (
                                        <div className="h-4 w-4 shrink-0 rounded bg-primary/20" />
                                    )}
                                    <span className="text-xs font-medium tracking-wider uppercase text-muted-foreground group-hover:text-foreground transition-colors duration-200">
                                        {article.feed.title}
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
                                            <span className="text-foreground font-medium break-words">
                                                {article.author}
                                            </span>
                                            <span className="hidden sm:inline">
                                                •
                                            </span>
                                        </>
                                    )}
                                    <span className="whitespace-nowrap">
                                        {publishedAtDisplay}
                                    </span>
                                    {currentReadTime && (
                                        <>
                                            <span className="hidden sm:inline">
                                                •
                                            </span>
                                            <span className="whitespace-nowrap">
                                                {currentReadTime} min read
                                            </span>
                                        </>
                                    )}
                                </div>

                                {/* Desktop Article Toolbar */}
                                {!shouldShowPreviewBanner &&
                                    typeof window !== "undefined" &&
                                    window.innerWidth >= 768 && (
                                        <ArticleToolbar
                                            article={article}
                                            isReadLater={optimisticReadLater}
                                            contentSource={contentSource}
                                            onContentSourceChange={
                                                setContentSource
                                            }
                                            hasTranslatedContent={
                                                !!translatedContent
                                            }
                                            translatedLanguage={
                                                translatedLanguage
                                            }
                                            onToggleReadLater={() => {
                                                const newReadLaterState =
                                                    !optimisticReadLater
                                                setOptimisticReadLater(
                                                    newReadLaterState
                                                )

                                                // Show toast immediately for instant feedback
                                                toast.success(
                                                    newReadLaterState
                                                        ? "Article saved to Read Later"
                                                        : "Article removed from Read Later"
                                                )

                                                updateArticle.mutate(
                                                    {
                                                        articleId: article.id,
                                                        data: {
                                                            is_read_later:
                                                                newReadLaterState,
                                                            // When saving for later, mark as unread to update sidebar count
                                                            is_read:
                                                                newReadLaterState
                                                                    ? false
                                                                    : article.is_read,
                                                        },
                                                        articleType:
                                                            article.article_type,
                                                    },
                                                    {
                                                        onError: () => {
                                                            // Revert optimistic update on error and show error
                                                            setOptimisticReadLater(
                                                                !newReadLaterState
                                                            )
                                                            toast.error(
                                                                "Failed to update article. Please try again."
                                                            )
                                                        },
                                                    }
                                                )
                                            }}
                                            onMarkAsRead={() => {
                                                // Mark as read and remove from read later instantly
                                                setOptimisticReadLater(false)
                                                toast.success(
                                                    "Article marked as read"
                                                )

                                                // Optimistically update the articles cache to instantly remove from read-later list
                                                queryClient.setQueriesData(
                                                    {
                                                        queryKey: [
                                                            RSS_QUERY_KEYS.ARTICLES,
                                                        ],
                                                    },
                                                    (
                                                        oldData:
                                                            | ArticlesInfiniteData
                                                            | undefined
                                                    ) => {
                                                        if (!oldData?.pages)
                                                            return oldData
                                                        return {
                                                            ...oldData,
                                                            pages: oldData.pages.map(
                                                                (
                                                                    page: ArticlesPageData
                                                                ) => ({
                                                                    ...page,
                                                                    items:
                                                                        page.items
                                                                            ?.filter(
                                                                                (
                                                                                    item: Article
                                                                                ) =>
                                                                                    // In read-later mode, remove this article entirely
                                                                                    isReadLaterMode
                                                                                        ? item.id !==
                                                                                          article.id
                                                                                        : true
                                                                            )
                                                                            .map(
                                                                                (
                                                                                    item: Article
                                                                                ) =>
                                                                                    item.id ===
                                                                                    article.id
                                                                                        ? {
                                                                                              ...item,
                                                                                              is_read: true,
                                                                                              is_read_later: false,
                                                                                          }
                                                                                        : item
                                                                            ) ||
                                                                        [],
                                                                })
                                                            ),
                                                        }
                                                    }
                                                )

                                                // Also update unread counts optimistically
                                                queryClient.setQueryData(
                                                    [
                                                        RSS_QUERY_KEYS.UNREAD_COUNTS,
                                                    ],
                                                    (
                                                        oldData:
                                                            | UnreadCountsData
                                                            | undefined
                                                    ) => {
                                                        if (!oldData)
                                                            return oldData
                                                        return {
                                                            ...oldData,
                                                            read_later_count:
                                                                Math.max(
                                                                    0,
                                                                    (oldData.read_later_count ||
                                                                        0) - 1
                                                                ),
                                                        }
                                                    }
                                                )

                                                // Immediately remove from list UI
                                                onArticleRemoved?.()

                                                updateArticle.mutate(
                                                    {
                                                        articleId: article.id,
                                                        data: {
                                                            is_read: true,
                                                            is_read_later: false,
                                                        },
                                                        articleType:
                                                            article.article_type,
                                                    },
                                                    {
                                                        onError: () => {
                                                            // Revert optimistic update on error
                                                            setOptimisticReadLater(
                                                                true
                                                            )
                                                            toast.error(
                                                                "Failed to mark article as read. Please try again."
                                                            )

                                                            // Revert cache optimistic updates
                                                            queryClient.invalidateQueries(
                                                                {
                                                                    queryKey: [
                                                                        RSS_QUERY_KEYS.ARTICLES,
                                                                    ],
                                                                }
                                                            )
                                                            queryClient.invalidateQueries(
                                                                {
                                                                    queryKey: [
                                                                        RSS_QUERY_KEYS.UNREAD_COUNTS,
                                                                    ],
                                                                }
                                                            )
                                                        },
                                                    }
                                                )
                                            }}
                                            onExtractFullText={
                                                handleExtractContent
                                            }
                                            onSummarize={handleSummarize}
                                            onTranslate={handleTranslate}
                                            isExtracting={
                                                extractFullText.isFetching
                                            }
                                            isSummarizing={
                                                summarizeArticle.isFetching
                                            }
                                            isTranslating={isTranslating}
                                            onBack={onBack}
                                            hideBackground={true}
                                            isReadLaterMode={isReadLaterMode}
                                        />
                                    )}
                            </div>
                        </div>

                        {/* Content Display */}
                        <div className="mt-8">
                            {/* AI Summary - Show when available */}
                            {(() => {
                                const hasValidSummary =
                                    aiSummary !== null &&
                                    aiSummary !== undefined &&
                                    aiSummary.length > 0
                                return (
                                    (isShowingSummary || hasValidSummary) &&
                                    hasValidSummary
                                )
                            })() && (
                                <div className="mb-8">
                                    <AiSummaryCard
                                        summary={aiSummary!}
                                        onDismiss={() => {
                                            setAiSummary(null)
                                            onSummaryChange(null, false)
                                        }}
                                    />
                                </div>
                            )}

                            {/* Article Content - Show based on selected source */}
                            {(() => {
                                const displayContent =
                                    contentSource === "translated" &&
                                    translatedContent
                                        ? translatedContent
                                        : contentSource === "extracted" &&
                                            article.extracted_content
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
                                            article.note) && (
                                            <blockquote className="border-l-4 border-primary/30 bg-muted/30 pl-4 italic text-muted-foreground prose prose-sm max-w-none">
                                                <div
                                                    dangerouslySetInnerHTML={{
                                                        __html:
                                                            article.note ||
                                                            article.description ||
                                                            "",
                                                    }}
                                                />
                                            </blockquote>
                                        )}
                                        <div className="flex flex-col items-center justify-center py-8 text-center">
                                            <div className="mx-auto max-w-md">
                                                <p className="text-sm text-muted-foreground">
                                                    This article doesn&apos;t
                                                    have any content available.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })()}
                        </div>

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
