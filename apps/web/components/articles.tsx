"use client"

import { ArticlesEmptyState } from "@/components/articles/ArticlesEmptyState"
import { ArticlesErrorState } from "@/components/articles/ArticlesErrorState"
import { ArticlesViewSkeleton } from "@/components/articles/ArticlesViewSkeleton"
import { FeedPreviewBanner } from "@/components/feeds/FeedPreviewBanner"
import { FeedSubscriptionModal } from "@/components/FeedSubscriptionModal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable"
import { SidebarLeftTrigger } from "@/components/ui/sidebar"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { useIsMobile } from "@/hooks/useMobile"
import type { Article, Feed, Folder } from "@readspace/shared"
import {
    ApiClient,
    useArticle,
    useFeed,
    useFeeds,
    useFolders,
    useInfiniteArticles,
    useInfiniteReadLaterArticles,
    useInfiniteRecentlyReadArticles,
    useInfiniteTodayArticles,
    useRefreshFeed,
    useUnreadCounts,
    useUpdateArticle,
} from "@readspace/shared"
import { RSS_QUERY_KEYS } from "@readspace/shared/src/api/query-keys"
import { useQueryClient } from "@tanstack/react-query"
import {
    CheckCheck,
    Eye,
    EyeOff,
    RefreshCw,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "react-hot-toast"
import { ArticleContent } from "./articles/ArticleContent"
import { ArticleContentSkeleton } from "./articles/ArticleContentSkeleton"
import { ArticlesList } from "./articles/ArticlesList"

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
    [key: string]: number
}

interface ArticlesViewProps {
    /** Initial title for the sidebar */
    initialSidebarTitle?: string
    /** Feed ID for filtering articles */
    feedId?: string
    /** Folder ID for filtering articles */
    folderId?: string
    /** Published since date filter */
    publishedSince?: string
    /** Published until date filter */
    publishedUntil?: string
    /** View mode for articles */
    mode?: "allArticles" | "recentlyRead" | "readLater" | "today"
    /** Callback for creating new folder */
    onCreateFolder?: () => void
    /** Callback for adding new feed */
    onAddFeed?: (folderId?: string) => void
}

/**
 * Main ArticlesView component that displays articles in a resizable layout
 * with list and content views.
 */
export function ArticlesView({
    initialSidebarTitle,
    feedId,
    folderId,
    publishedSince,
    publishedUntil,
    mode = "allArticles",
    onCreateFolder,
    onAddFeed,
}: ArticlesViewProps) {
    // Component state
    const [selectedArticleId, setSelectedArticleId] = useState<string | null>(
        null
    )
    const [showContent, setShowContent] = useState(false)
    const [showUnreadOnly, setShowUnreadOnly] = useState(false)
    const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] =
        useState(false)

    // Article content state
    const [currentContent, setCurrentContent] = useState("")
    const [currentReadTime, setCurrentReadTime] = useState<number | null>(null)
    const [isShowingSummary, setIsShowingSummary] = useState(false)
    const [isTranslating, setIsTranslating] = useState(false)
    const [isDeepRefreshing, setIsDeepRefreshing] = useState(false)
    const [isPreviewRefreshing, setIsPreviewRefreshing] = useState(false)
    const [previewFeedData, setPreviewFeedData] = useState<Feed | null>(null)
    const [isMarkingAllRead, setIsMarkingAllRead] = useState(false)
    const [previewRefreshFailed, setPreviewRefreshFailed] = useState(false)

    // Ref to track if preview refresh has already been triggered for this feed
    const hasRefreshedPreview = useRef(false)

    // Hooks
    const isMobile = useIsMobile()
    const queryClient = useQueryClient()

    // Data queries - optimized with conditional enabling
    const { data: allUserFeeds } = useFeeds(
        {},
        {
            refetchOnMount: false,
            refetchOnWindowFocus: false,
            staleTime: 5 * 60 * 1000,
            enabled: true, // Always needed for unread count calculations
        }
    )

    // Fetch folders data only when viewing a specific folder
    const { data: allFolders } = useFolders({
        enabled: !!folderId,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        staleTime: 5 * 60 * 1000,
    })

    // Fetch feed data only when viewing a specific feed to check subscription status
    // For preview mode, we'll get feed data from the refresh response instead
    const {
        data: fetchedFeedData,
        error: feedError,
        isLoading: isFeedLoading
    } = useFeed(feedId || "", {
        enabled: !!feedId && !isPreviewRefreshing,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        staleTime: 5 * 60 * 1000,
    })

    // Use preview feed data if available, otherwise use fetched data
    const feedData = previewFeedData || fetchedFeedData

    // Unread counts query - only when needed for badges
    const { data: unreadCounts } = useUnreadCounts(undefined, {
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        staleTime: 5 * 60 * 1000,
        enabled: true, // Always needed for badges
    })

    // Current article data
    const { data: currentArticle } = useArticle(selectedArticleId || "", {
        enabled: !!selectedArticleId,
    })

    // Article update mutation
    const updateArticle = useUpdateArticle()

    // Feed refresh mutation
    const refreshFeed = useRefreshFeed()

    // View mode flags
    const isRecentlyReadMode = mode === "recentlyRead"
    const isReadLaterMode = mode === "readLater"
    const isTodayMode = mode === "today"

    // Determine sidebar title based on view mode and available data
    const sidebarTitle = isRecentlyReadMode
        ? "Recently Read"
        : isReadLaterMode
            ? "Read Later"
            : isTodayMode
                ? "Today"
                : feedId && feedData?.title
                    ? feedData.title
                    : folderId && allFolders
                        ? (allFolders as Folder[])?.find((f) => f.id === folderId)
                            ?.name ||
                        initialSidebarTitle ||
                        "All Articles"
                        : initialSidebarTitle || "All Articles"

    // Calculate unread count for the badge based on current view
    const unreadCount = useMemo(() => {
        const typedUnreadCounts =
            (unreadCounts as {
                total_unread?: number
                today_count?: number
                read_later_count?: number
                unread_by_folder?: Array<{
                    folder_id: string
                    unread_count: number
                }>
            }) || {}

        // Don't show unread count for recently read mode
        if (isRecentlyReadMode) return 0

        // Handle specific modes
        if (isReadLaterMode) {
            return typedUnreadCounts?.read_later_count || 0
        }

        if (isTodayMode) {
            return typedUnreadCounts?.today_count || 0
        }

        if (feedId) {
            // Individual feed: get unread count from the feed data
            const currentFeed = (allUserFeeds as Feed[])?.find(
                (f) => f.id === feedId
            )
            return currentFeed?.unread_count || 0
        } else if (folderId) {
            // Folder view: get unread count for this folder
            const folderUnreadCounts = typedUnreadCounts?.unread_by_folder as
                | Record<string, number>
                | undefined
            return folderUnreadCounts?.[folderId] ?? 0
        } else {
            // All articles view: get total unread count
            return typedUnreadCounts?.total_unread || 0
        }
    }, [
        unreadCounts,
        isRecentlyReadMode,
        isReadLaterMode,
        isTodayMode,
        feedId,
        folderId,
        allUserFeeds,
    ])

    // Build query params
    const queryParams = useMemo(() => {
        const params: {
            feedIds?: string[]
            folderId?: string
            limit?: number
            isRead?: boolean
            isReadLater?: boolean
            isFavorite?: boolean
        } = {
            limit: 25,
        }

        if (feedId) {
            // Single feed view
            params.feedIds = [feedId]
        } else if (folderId) {
            // Folder view - let backend filter by folder
            params.folderId = folderId
        }
        // If no feedId or folderId, show all articles (no filter)

        return params
    }, [feedId, folderId])

    // Use appropriate infinite query based on mode
    const todayQuery = useInfiniteTodayArticles({ limit: 25 }, {
        enabled: isTodayMode,
    } as any)

    const recentlyReadQuery = useInfiniteRecentlyReadArticles({ limit: 25 }, {
        enabled: isRecentlyReadMode,
    } as any)

    const readLaterQuery = useInfiniteReadLaterArticles({ limit: 25 }, {
        enabled: isReadLaterMode,
    } as any)

    const allArticlesQuery = useInfiniteArticles(queryParams, {
        enabled: !isTodayMode && !isRecentlyReadMode && !isReadLaterMode,
        staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
        gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    } as any)

    // Select the active query based on mode
    const activeQuery = isTodayMode
        ? todayQuery
        : isRecentlyReadMode
            ? recentlyReadQuery
            : isReadLaterMode
                ? readLaterQuery
                : allArticlesQuery

    const {
        data,
        isLoading: isArticlesLoading,
        isFetching,
        isFetchingNextPage,
        fetchNextPage,
        hasNextPage,
        refetch: refetchArticles,
    } = activeQuery

    // Flatten paginated data into a single array
    const allArticles = useMemo(() => {
        const infiniteData = data as any
        if (!infiniteData?.pages) return []
        return infiniteData.pages.flatMap((page: any) => page.items)
    }, [data])

    // Create a unique key for the current view to detect when we switch contexts
    const viewKey = useMemo(() => {
        return `${feedId || "all"}-${folderId || "none"}-${mode}-${publishedSince || ""}-${publishedUntil || ""}`
    }, [feedId, folderId, mode, publishedSince, publishedUntil])

    // Determine if we should show preview banner for feeds
    const shouldShowPreviewBanner = !!(
        feedId &&
        feedData &&
        feedData.is_subscribed === false
    )

    const selectedArticle = currentArticle

    // Client-side filtered articles based on unread toggle
    // Note: Don't filter in Read Later mode - users want to see ALL read-later articles
    const filteredArticles = useMemo(() => {
        if (showUnreadOnly && !isReadLaterMode) {
            return allArticles.filter((article: Article) => !article.is_read)
        }
        return allArticles
    }, [allArticles, showUnreadOnly, isReadLaterMode])

    /**
     * Handle article selection - DON'T auto-mark as read here to avoid query invalidation race
     */
    const handleArticleSelect = useCallback(
        (articleId: string) => {
            setSelectedArticleId(articleId)
            // Reset content state when selecting new article
            setCurrentContent("")
            setCurrentReadTime(null)
            setIsShowingSummary(false)
            setIsTranslating(false)
            if (isMobile) {
                setShowContent(true)
            }

            // DON'T auto-mark as read on selection - let the click handler on ArticleContent do it
            // This prevents query invalidation from racing with the article query fetch
        },
        [isMobile]
    )

    /**
     * Handle back to list on mobile
     */
    const handleBackToList = () => {
        if (isMobile) {
            setShowContent(false)
        }
    }

    /**
     * Handle content updates from ArticleContent
     */
    const handleContentChange = (content: string) => {
        setCurrentContent(content)
    }

    /**
     * Handle read time updates
     */
    const handleReadTimeChange = (readTime: number | null) => {
        setCurrentReadTime(readTime)
    }

    /**
     * Handle summary state changes
     */
    const handleSummaryChange = (
        summary: string | null,
        isShowing: boolean
    ) => {
        setIsShowingSummary(isShowing)
    }

    /**
     * Handle translation state changes
     */
    const handleTranslationChange = (translating: boolean) => {
        setIsTranslating(translating)
    }

    /**
     * Handle marking article as read
     */
    const handleMarkAsRead = () => {
        if (!selectedArticle) return

        updateArticle.mutate({
            articleId: selectedArticle.id,
            data: { is_read: true },
            articleType:
                "article_type" in selectedArticle
                    ? selectedArticle.article_type
                    : "feed",
        })
    }

    /**
     * Handle article removal from list
     */
    const handleArticleRemoved = () => {
        // Select next article or clear selection
        const currentIndex = allArticles.findIndex(
            (a: Article) => a.id === selectedArticleId
        )
        if (currentIndex >= 0 && allArticles.length > 1) {
            const nextIndex =
                currentIndex < allArticles.length - 1
                    ? currentIndex + 1
                    : currentIndex - 1
            setSelectedArticleId(allArticles[nextIndex]?.id || null)
        } else {
            setSelectedArticleId(null)
            if (isMobile) setShowContent(false)
        }
    }

    // Refresh with custom message
    const handleRefreshWithMessage = async (message: string) => {
        toast.loading(message, { id: "refresh" })
        try {
            // Invalidate articles cache to force fresh fetch from server
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.ARTICLES],
            })

            // Also invalidate unread counts to ensure they're updated
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
            })

            await refetchArticles()
            toast.success("Articles refreshed!", { id: "refresh" })
        } catch (error) {
            console.error("Refresh failed:", error)
            toast.error("Failed to refresh articles. Please try again.", {
                id: "refresh",
            })
        }
    }

    // Deep refresh: poll external RSS feed (only for individual feeds)
    const handleDeepRefresh = async () => {
        if (!feedId) return

        setIsDeepRefreshing(true)
        toast.loading("Checking for new articles...", { id: "deep-refresh" })

        try {
            await refreshFeed.mutateAsync({
                feedId: feedId,
                forceRefetch: true,
            })

            // Invalidate all relevant caches to force fresh fetch from server
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.ARTICLES],
            })
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
            })
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.FEEDS],
            })

            // After deep refresh completes, refetch articles
            await refetchArticles()
            toast.success("Check complete! Articles updated.", {
                id: "deep-refresh",
            })
        } catch (error) {
            console.error("Deep refresh failed:", error)
            toast.error("Failed to check for new articles. Please try again.", {
                id: "deep-refresh",
            })
        } finally {
            setIsDeepRefreshing(false)
        }
    }

    const toggleShowUnreadOnly = () => {
        setShowUnreadOnly((prev) => !prev)
    }

    // Mark all articles as read (for feed or folder)
    const handleMarkAllAsRead = async () => {
        if (!feedId && !folderId) return

        setIsMarkingAllRead(true)
        toast.loading("Marking all as read...", { id: "mark-all-read" })

        try {
            if (feedId) {
                await ApiClient.rss.markFeedAllRead(feedId)
                toast.success("All articles marked as read!", {
                    id: "mark-all-read",
                })
            } else if (folderId) {
                await ApiClient.rss.markFolderAllRead(folderId)
                toast.success("All articles in folder marked as read!", {
                    id: "mark-all-read",
                })
            }

            // Invalidate all relevant caches to force fresh fetch from server
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.ARTICLES],
            })
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
            })
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.FEEDS],
            })

            // Refetch articles to update the view
            await refetchArticles()
        } catch (error) {
            console.error("Mark all as read failed:", error)
            toast.error("Failed to mark all as read. Please try again.", {
                id: "mark-all-read",
            })
        } finally {
            setIsMarkingAllRead(false)
        }
    }

    // Preview mode: refresh feed on mount to get latest articles
    // Only refresh once per feed per session (hasRefreshedPreview tracks this)
    useEffect(() => {
        if (shouldShowPreviewBanner && feedId && !hasRefreshedPreview.current) {
            hasRefreshedPreview.current = true
            setIsPreviewRefreshing(true)
            setPreviewRefreshFailed(false)

            console.log("[Preview Mode] Refreshing feed for preview:", feedId)

            // Call API directly with preview=true parameter
            ApiClient.rss
                .refreshFeed(feedId, true, true)
                .then((feed) => {
                    console.log("[Preview Mode] Feed refresh successful")
                    // Store the feed data from refresh response
                    setPreviewFeedData(feed)
                    setPreviewRefreshFailed(false)
                    // Invalidate articles cache to trigger refetch
                    queryClient.invalidateQueries({
                        queryKey: [RSS_QUERY_KEYS.ARTICLES],
                    })
                    queryClient.invalidateQueries({
                        queryKey: [RSS_QUERY_KEYS.FEEDS],
                    })
                })
                .catch((error) => {
                    console.error(
                        "[Preview Mode] Preview refresh failed:",
                        error
                    )
                    setPreviewRefreshFailed(true)
                })
                .finally(() => {
                    setIsPreviewRefreshing(false)
                })
        }
    }, [shouldShowPreviewBanner, feedId, queryClient])

    // Clear selected article if it's no longer in the articles list
    useEffect(() => {
        if (selectedArticleId && allArticles.length > 0) {
            const selectedArticleExists = allArticles.some(
                (article: Article) => article.id === selectedArticleId
            )
            if (!selectedArticleExists) {
                setSelectedArticleId(null)
                if (isMobile) setShowContent(false)
            }
        }
    }, [selectedArticleId, allArticles, feedId, folderId, isMobile])

    // Reset selected article when view changes
    useEffect(() => {
        setSelectedArticleId(null)
        setShowContent(false)
        setCurrentContent("")
        setCurrentReadTime(null)
        setIsShowingSummary(false)
        setIsTranslating(false)
        setPreviewRefreshFailed(false)
        hasRefreshedPreview.current = false
    }, [viewKey])

    // Auto-select first article when we have articles but no current selection (desktop only)
    useEffect(() => {
        // Skip auto-selection entirely on mobile
        if (isMobile) return

        // Only auto-select if we have articles and no selection
        // Check both isArticlesLoading and isFetching to ensure data is stable
        if (
            allArticles.length > 0 &&
            !selectedArticleId &&
            !showContent &&
            !isArticlesLoading &&
            !isFetching
        ) {
            // Sort articles by published date (newest first) to match ArticlesList display order
            const sortedArticles = [...allArticles].sort(
                (a: Article, b: Article) => {
                    if (!a.published_at) return 1
                    if (!b.published_at) return -1
                    return (
                        new Date(b.published_at).getTime() -
                        new Date(a.published_at).getTime()
                    )
                }
            )

            // Select first article (or first unread if filter is on)
            const firstArticle = showUnreadOnly
                ? sortedArticles.find((a: Article) => !a.is_read) ||
                sortedArticles[0]
                : sortedArticles[0]

            if (firstArticle?.id) {
                setSelectedArticleId(firstArticle.id)
            }
        }
    }, [
        viewKey, // This ensures effect runs when view changes
        allArticles,
        selectedArticleId,
        isMobile,
        showContent,
        showUnreadOnly,
        isArticlesLoading,
        isFetching, // Also check if data is being fetched
    ])

    // Show skeleton during initial loading or preview refresh only
    // Don't show skeleton when refetching with existing data (prevents flash on invalidation)
    const isInitialLoading =
        (isArticlesLoading && allArticles.length === 0) ||
        isPreviewRefreshing

    if (isInitialLoading) {
        return <ArticlesViewSkeleton showUnreadBadge={false} />
    }

    // Show error state for feed errors (e.g., 404 Not Found)
    // Check feed error first before showing empty state
    if (feedId && feedError && !isFeedLoading && !isPreviewRefreshing) {
        return (
            <div className="flex h-[calc(100vh-1rem)] w-full bg-background rounded-xl shadow-sm">
                <ArticlesErrorState
                    error={feedError}
                    onRetry={() => {
                        // Trigger feed refetch
                        handleRefreshWithMessage("Retrying...")
                    }}
                />
            </div>
        )
    }

    // Show empty state when no articles (but not when still loading)
    if (
        !isArticlesLoading &&
        !isFetching &&
        !isPreviewRefreshing &&
        filteredArticles.length === 0 &&
        allArticles.length === 0
    ) {
        return (
            <div className="flex h-[calc(100vh-1rem)] w-full bg-background rounded-xl shadow-sm">
                <ArticlesEmptyState
                    mode={mode}
                    feedId={feedId}
                    folderId={folderId}
                    isPreviewMode={shouldShowPreviewBanner}
                    previewRefreshFailed={previewRefreshFailed}
                    onRefresh={() =>
                        handleRefreshWithMessage("Refreshing articles...")
                    }
                />
            </div>
        )
    }

    // Show message when filtering hides all articles
    if (filteredArticles.length === 0 && allArticles.length > 0) {
        return (
            <div className="flex h-full md:h-[calc(100vh-1rem)] w-full bg-background md:rounded-xl md:shadow-sm">
                <div className="w-full flex flex-col items-center justify-center gap-4">
                    <p className="text-muted-foreground">
                        No unread articles found matching your filters.
                    </p>
                    <Button variant="outline" onClick={toggleShowUnreadOnly}>
                        Show All Articles
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-[100dvh] md:h-[calc(100vh-1rem)] w-full bg-background md:rounded-xl md:shadow-sm">
            {isMobile ? (
                // Mobile: Single panel with navigation
                <div className="w-full h-full">
                    {showContent && selectedArticle ? (
                        <div className="flex h-full flex-col">
                            <ArticleContent
                                article={selectedArticle as Article}
                                currentContent={currentContent}
                                currentReadTime={currentReadTime}
                                isShowingSummary={isShowingSummary}
                                isTranslating={isTranslating}
                                isRecentlyReadMode={isRecentlyReadMode}
                                isReadLaterMode={isReadLaterMode}
                                shouldShowPreviewBanner={
                                    shouldShowPreviewBanner
                                }
                                onContentChange={handleContentChange}
                                onReadTimeChange={handleReadTimeChange}
                                onSummaryChange={handleSummaryChange}
                                onTranslationChange={handleTranslationChange}
                                onMarkAsRead={handleMarkAsRead}
                                onArticleRemoved={handleArticleRemoved}
                                onBack={handleBackToList}
                            />
                        </div>
                    ) : showContent ? (
                        <ArticleContentSkeleton />
                    ) : (
                        <div className="flex flex-col h-full">
                            {/* Mobile Toolbar */}
                            <div className="flex-shrink-0 flex items-center justify-between border-b px-4 py-3">
                                <div className="flex items-center gap-2 flex-1">
                                    <SidebarLeftTrigger className="flex-shrink-0" />
                                    <h1 className="text-lg font-semibold truncate max-w-[200px]">
                                        {sidebarTitle}
                                    </h1>
                                    {unreadCount > 0 && (
                                        <Badge
                                            variant="outline"
                                            className="min-w-3 px-2 flex-shrink-0"
                                        >
                                            {unreadCount}
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Unread filter toggle - hidden in Read Later mode */}
                                    {!isReadLaterMode && (
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant={
                                                            showUnreadOnly
                                                                ? "default"
                                                                : "ghost"
                                                        }
                                                        size="sm"
                                                        onClick={
                                                            toggleShowUnreadOnly
                                                        }
                                                    >
                                                        {showUnreadOnly ? (
                                                            <Eye className="h-4 w-4" />
                                                        ) : (
                                                            <EyeOff className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    {showUnreadOnly
                                                        ? "Show all articles"
                                                        : "Show unread only"}
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    )}

                                    {/* Mark all as read button - only for feeds and folders */}
                                    {(feedId || folderId) &&
                                        !shouldShowPreviewBanner && (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={
                                                                handleMarkAllAsRead
                                                            }
                                                            disabled={
                                                                isMarkingAllRead
                                                            }
                                                        >
                                                            <CheckCheck className="h-4 w-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        Mark all as read
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}

                                    {/* Refresh button - deep refresh for individual feeds, quick refresh for others */}
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={
                                                        feedId
                                                            ? handleDeepRefresh
                                                            : () =>
                                                                handleRefreshWithMessage(
                                                                    "Refreshing articles..."
                                                                )
                                                    }
                                                    disabled={isDeepRefreshing}
                                                >
                                                    <RefreshCw
                                                        className={`h-4 w-4 ${isDeepRefreshing ? "animate-spin" : ""}`}
                                                    />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                {feedId
                                                    ? "Check for new articles"
                                                    : "Refresh articles"}
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                            </div>

                            {/* Preview banner for unsubscribed feeds - mobile */}
                            {shouldShowPreviewBanner && (
                                <div className="flex-shrink-0">
                                    <FeedPreviewBanner
                                        feedTitle={feedData?.title}
                                        feedDescription={feedData?.description}
                                        onFollow={() =>
                                            setIsSubscriptionModalOpen(true)
                                        }
                                    />
                                </div>
                            )}

                            {/* Wrapper to establish proper height for virtualizer */}
                            <div className="flex-1 min-h-0 overflow-hidden">
                                <ArticlesList
                                    articles={filteredArticles}
                                    selectedArticleId={selectedArticleId}
                                    isLoading={isArticlesLoading}
                                    isFetching={isFetching}
                                    isFetchingNextPage={isFetchingNextPage}
                                    hasNextPage={hasNextPage}
                                    showUnreadOnly={showUnreadOnly}
                                    isRecentlyReadMode={isRecentlyReadMode}
                                    isReadLaterMode={isReadLaterMode}
                                    isTodayMode={isTodayMode}
                                    fetchNextPage={fetchNextPage}
                                    onArticleSelect={handleArticleSelect}
                                />
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                // Desktop: Resizable panels with proper toolbar structure
                <div className="hidden md:flex w-full">
                    <ResizablePanelGroup direction="horizontal">
                        <ResizablePanel
                            defaultSize={25}
                            minSize={20}
                            maxSize={60}
                        >
                            <div className="flex h-full flex-col border-r">
                                {/* Desktop List Toolbar */}
                                <div className="flex h-14 items-center justify-between border-b px-4">
                                    <div className="flex items-center space-x-2 min-w-0 flex-1">
                                        <SidebarLeftTrigger className="-ml-1" />
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <h2 className="font-semibold truncate">
                                                        {sidebarTitle}
                                                    </h2>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>{sidebarTitle}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                        {unreadCount > 0 && (
                                            <Badge
                                                variant="outline"
                                                className="min-w-3 px-1 flex-shrink-0"
                                            >
                                                {unreadCount}
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {/* Unread filter toggle - hidden in Read Later mode */}
                                        {!isReadLaterMode && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 transition-all duration-200 hover:scale-110 hover:bg-muted/60"
                                                onClick={toggleShowUnreadOnly}
                                                title={
                                                    showUnreadOnly
                                                        ? "Show all articles"
                                                        : "Show unread only"
                                                }
                                            >
                                                {showUnreadOnly ? (
                                                    <Eye className="h-4 w-4 transition-transform duration-200" />
                                                ) : (
                                                    <EyeOff className="h-4 w-4 transition-transform duration-200" />
                                                )}
                                            </Button>
                                        )}

                                        {/* Mark all as read button - only for feeds and folders */}
                                        {(feedId || folderId) &&
                                            !shouldShowPreviewBanner && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 transition-all duration-200 hover:scale-110 hover:bg-muted/60"
                                                    onClick={
                                                        handleMarkAllAsRead
                                                    }
                                                    disabled={isMarkingAllRead}
                                                    title="Mark all as read"
                                                >
                                                    <CheckCheck className="h-4 w-4 transition-transform duration-200" />
                                                </Button>
                                            )}

                                        {/* Individual feeds: single deep refresh button */}
                                        {feedId ? (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 transition-all duration-200 hover:scale-110 hover:bg-muted/60"
                                                onClick={handleDeepRefresh}
                                                title="Check for new articles"
                                                disabled={isDeepRefreshing}
                                            >
                                                <RefreshCw className={`h-4 w-4 transition-transform duration-200 ${isDeepRefreshing ? "animate-spin" : "hover:rotate-180"}`} />
                                            </Button>
                                        ) : (
                                            /* Other views: simple refresh button (shallow only) */
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 transition-all duration-200 hover:scale-110 hover:bg-muted/60"
                                                onClick={() =>
                                                    handleRefreshWithMessage(
                                                        "Refreshing articles..."
                                                    )
                                                }
                                                title="Refresh"
                                            >
                                                <RefreshCw className="h-4 w-4 transition-transform duration-200 hover:rotate-180" />
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* Preview banner for unsubscribed feeds - desktop */}
                                {shouldShowPreviewBanner && (
                                    <FeedPreviewBanner
                                        feedTitle={feedData?.title}
                                        feedDescription={feedData?.description}
                                        onFollow={() =>
                                            setIsSubscriptionModalOpen(true)
                                        }
                                    />
                                )}

                                <ArticlesList
                                    articles={filteredArticles}
                                    selectedArticleId={selectedArticleId}
                                    isLoading={isArticlesLoading}
                                    isFetching={isFetching}
                                    isFetchingNextPage={isFetchingNextPage}
                                    hasNextPage={hasNextPage}
                                    showUnreadOnly={showUnreadOnly}
                                    isRecentlyReadMode={isRecentlyReadMode}
                                    isReadLaterMode={isReadLaterMode}
                                    isTodayMode={isTodayMode}
                                    fetchNextPage={fetchNextPage}
                                    onArticleSelect={handleArticleSelect}
                                />
                            </div>
                        </ResizablePanel>

                        <ResizableHandle />

                        <ResizablePanel defaultSize={75} minSize={50}>
                            {selectedArticle ? (
                                <ArticleContent
                                    article={selectedArticle as Article}
                                    currentContent={currentContent}
                                    currentReadTime={currentReadTime}
                                    isShowingSummary={isShowingSummary}
                                    isTranslating={isTranslating}
                                    isRecentlyReadMode={isRecentlyReadMode}
                                    isReadLaterMode={isReadLaterMode}
                                    shouldShowPreviewBanner={
                                        shouldShowPreviewBanner
                                    }
                                    onContentChange={handleContentChange}
                                    onReadTimeChange={handleReadTimeChange}
                                    onSummaryChange={handleSummaryChange}
                                    onTranslationChange={
                                        handleTranslationChange
                                    }
                                    onMarkAsRead={handleMarkAsRead}
                                    onArticleRemoved={handleArticleRemoved}
                                />
                            ) : (
                                <ArticleContentSkeleton />
                            )}
                        </ResizablePanel>
                    </ResizablePanelGroup>
                </div>
            )}

            {/* Subscription modal */}
            {feedData && (
                <FeedSubscriptionModal
                    isOpen={isSubscriptionModalOpen}
                    onClose={() => setIsSubscriptionModalOpen(false)}
                    feed={feedData}
                    onSuccess={() => {
                        // Update feed data to mark as subscribed (exit preview mode)
                        setPreviewFeedData((prev) =>
                            prev ? { ...prev, is_subscribed: true } : null
                        )
                    }}
                />
            )}
        </div>
    )
}
