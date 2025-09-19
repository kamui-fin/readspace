"use client"

import { ArticlesEmptyState } from "@/components/articles/ArticlesEmptyState"
import { ArticlesViewSkeleton } from "@/components/articles/ArticlesViewSkeleton"
import { FeedPreviewBanner } from "@/components/feeds/FeedPreviewBanner"
import { FeedSubscriptionModal } from "@/components/FeedSubscriptionModal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { useArticlesQuery } from "@/hooks/useArticlesQuery"
import { useArticlesRefresh } from "@/hooks/useArticlesRefresh"
import { useIsMobile, useIsTablet } from "@/hooks/useMobile"
import { useClearPendingNavigation } from "@/hooks/useNavigationState"
import { useQueryClient } from "@tanstack/react-query"
import type { Article, Feed } from "@readspace/shared"
import {
    useArticle,
    useFeed,
    useFeeds,
    useUnreadCounts,
    useUpdateArticle,
} from "@readspace/shared"
import { RSS_QUERY_KEYS } from "@readspace/shared/src/api/query-keys"
import {
    CheckCircle2,
    Eye,
    EyeOff,
    MoreVertical,
    RefreshCw,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ArticleContent } from "./articles/ArticleContent"
import { ArticlesList } from "./articles/ArticlesList"

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

    // Hooks
    const isMobile = useIsMobile()
    const isTablet = useIsTablet()
    const { clearPending } = useClearPendingNavigation()
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

    // Fetch feed data only when viewing a specific feed to check subscription status
    const { data: feedData } = useFeed(feedId || "", {
        enabled: !!feedId,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        staleTime: 5 * 60 * 1000,
    })

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

    // View mode flags
    const isRecentlyReadMode = mode === "recentlyRead"
    const isReadLaterMode = mode === "readLater"
    const isTodayMode = mode === "today"

    const sidebarTitle = isRecentlyReadMode
        ? "Recently Read"
        : isReadLaterMode
            ? "Read Later"
            : isTodayMode
                ? "Today"
                : initialSidebarTitle || "All Articles"

    // Calculate unread count for the badge based on current view
    const unreadCount = useMemo(() => {
        const typedUnreadCounts = (unreadCounts as {
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
            const folderUnreadCount =
                typedUnreadCounts?.unread_by_folder?.find(
                    (item) => item.folder_id === folderId
                )?.unread_count || 0
            return folderUnreadCount
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

    // Articles query
    const {
        articles: allArticles,
        isLoading: isArticlesLoading,
        isFetching,
        fetchNextPage,
        hasNextPage,
        refetch: refetchArticles,
    } = useArticlesQuery({
        mode: mode || "allArticles",
        feedId: feedId,
        folderId: folderId,
        publishedSince: publishedSince,
        publishedUntil: publishedUntil,
    })

    // Refresh functionality
    const { startRefresh, isDeepRefreshing } = useArticlesRefresh({
        onRefreshComplete: refetchArticles,
    })

    // Determine if we should show preview banner for feeds
    const shouldShowPreviewBanner = !!(
        feedId &&
        feedData &&
        feedData.is_subscribed === false
    )

    // Get selected article from current articles list or fetch separately
    const selectedArticle = selectedArticleId
        ? allArticles.find((a) => a.id === selectedArticleId) || currentArticle
        : null

    // Client-side filtered articles based on unread toggle
    const filteredArticles = useMemo(() => {
        if (showUnreadOnly) {
            return allArticles.filter((article: Article) => !article.is_read)
        }
        return allArticles
    }, [allArticles, showUnreadOnly])

    /**
     * Handle article selection with automatic mark as read
     */
    const handleArticleSelect = useCallback((articleId: string) => {
        setSelectedArticleId(articleId)
        // Reset content state when selecting new article
        setCurrentContent("")
        setCurrentReadTime(null)
        setIsShowingSummary(false)
        setIsTranslating(false)
        if (isMobile) {
            setShowContent(true)
        }

        // Auto-mark as read on click (desktop only, not in preview mode)
        if (!isMobile && !shouldShowPreviewBanner) {
            const article = allArticles.find((a) => a.id === articleId)
            if (!isRecentlyReadMode && article && !article.is_read) {
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
                                    item.id === articleId
                                        ? { ...item, is_read: true }
                                        : item
                                ) || []
                            }))
                        };
                    }
                );

                // Also update unread counts optimistically
                queryClient.setQueryData(
                    [RSS_QUERY_KEYS.UNREAD_COUNTS],
                    (oldData: any) => {
                        if (!oldData) return oldData;
                        return {
                            ...oldData,
                            total_unread: Math.max(0, (oldData.total_unread || 0) - 1)
                        };
                    }
                );

                // Now perform the actual mutation
                updateArticle.mutate({
                    articleId,
                    data: { is_read: true },
                    articleType: article.article_type || "feed",
                })
            }
        }
    }, [
        isMobile,
        shouldShowPreviewBanner,
        allArticles,
        isRecentlyReadMode,
        updateArticle,
        queryClient,
    ])

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
    const handleContentChange = (content: string, key?: string) => {
        console.log("📄 Parent: Content change received:", {
            contentLength: content.length,
            contentKey: key,
            contentPreview: content.substring(0, 100) + "...",
            selectedArticleId
        })
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
        console.log("🧠 Parent: Summary change received:", {
            hasSummary: !!summary,
            summaryLength: summary?.length || 0,
            isShowing,
            summaryPreview: summary?.substring(0, 100) + "..." || null
        })
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
            (a) => a.id === selectedArticleId
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

    /**
     * Handle refresh actions
     */
    const handleRefresh = (isDeep = false) => {
        if (isDeep) {
            // For deep refresh, use the background task system
            if (folderId) {
                // Get all feeds in the folder
                const folderFeeds = (allUserFeeds as Feed[])?.filter(
                    (feed) => feed.folder_id === folderId
                )
                const feedIds = folderFeeds?.map((feed) => feed.id) || []
                startRefresh(feedIds, "folder", isDeep)
            } else {
                startRefresh(undefined, "all", isDeep)
            }
        } else {
            // For normal refresh, just refetch articles from the database
            refetchArticles()
        }
    }

    const toggleShowUnreadOnly = () => {
        setShowUnreadOnly((prev) => !prev)
    }

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

    // Clear pending navigation state when component mounts
    useEffect(() => {
        clearPending()
    }, [feedId, folderId, mode, clearPending])

    // Reset selected article when view changes
    useEffect(() => {
        setSelectedArticleId(null)
        setShowContent(false)
        setCurrentContent("")
        setCurrentReadTime(null)
        setIsShowingSummary(false)
        setIsTranslating(false)
    }, [feedId, folderId, mode, publishedSince, publishedUntil])

    // Auto-select first article when we have articles but no current selection (desktop only)
    useEffect(() => {
        if (
            allArticles.length > 0 &&
            !selectedArticleId &&
            !isMobile &&
            !showContent
        ) {
            // Use a small timeout to ensure data has stabilized
            const timer = setTimeout(() => {
                if (allArticles.length > 0 && !selectedArticleId && !isMobile) {
                    const firstArticle = showUnreadOnly
                        ? allArticles.find((a: Article) => !a.is_read) ||
                        allArticles[0]
                        : allArticles[0]
                    setSelectedArticleId(firstArticle?.id || null)
                }
            }, 100)

            return () => clearTimeout(timer)
        }
    }, [
        allArticles.length,
        selectedArticleId,
        isMobile,
        showContent,
        showUnreadOnly,
    ])

    // Show skeleton during initial loading
    if (isArticlesLoading && allArticles.length === 0) {
        return (
            <ArticlesViewSkeleton
                showUnreadBadge={false}
            />
        )
    }

    // Show empty state when no articles
    if (
        !isArticlesLoading &&
        filteredArticles.length === 0 &&
        allArticles.length === 0
    ) {
        return (
            <div className="flex h-[calc(100vh-1rem)] w-full bg-background rounded-xl shadow-sm">
                <ArticlesEmptyState
                    mode={mode}
                    feedId={feedId}
                    folderId={folderId}
                    onRefresh={() => handleRefresh(false)}
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
        <div className="flex h-full md:h-[calc(100vh-1rem)] w-full bg-background md:rounded-xl md:shadow-sm">

            {isMobile ? (
                // Mobile: Single panel with navigation
                <div className="w-full">
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
                                shouldShowPreviewBanner={shouldShowPreviewBanner}
                                onContentChange={handleContentChange}
                                onReadTimeChange={handleReadTimeChange}
                                onSummaryChange={handleSummaryChange}
                                onTranslationChange={handleTranslationChange}
                                onMarkAsRead={handleMarkAsRead}
                                onArticleRemoved={handleArticleRemoved}
                                onBack={handleBackToList}
                            />
                        </div>
                    ) : (
                        <div className="flex h-full flex-col">
                            {/* Mobile Toolbar */}
                            <div className="flex items-center justify-between border-b px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <SidebarLeftTrigger />
                                    <h1 className="text-lg font-semibold">{sidebarTitle}</h1>
                                    {unreadCount > 0 && (
                                        <Badge variant="outline" className="min-w-3 px-2 flex-shrink-0">
                                            {unreadCount}
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Unread filter toggle */}
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    variant={
                                                        showUnreadOnly ? "default" : "ghost"
                                                    }
                                                    size="sm"
                                                    onClick={toggleShowUnreadOnly}
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

                                    {/* Direct refresh button */}
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleRefresh(false)}
                                                    disabled={isDeepRefreshing}
                                                >
                                                    <RefreshCw
                                                        className={`h-4 w-4 ${isDeepRefreshing ? "animate-spin" : ""}`}
                                                    />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                Refresh articles
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>

                                    {/* More actions - hide for preview feeds */}
                                    {!shouldShowPreviewBanner && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    onClick={() => handleRefresh(true)}
                                                    disabled={isDeepRefreshing}
                                                >
                                                    <RefreshCw className="h-4 w-4 mr-2" />
                                                    Force Refresh
                                                </DropdownMenuItem>
                                                {onCreateFolder && (
                                                    <DropdownMenuItem onClick={onCreateFolder}>
                                                        Create Folder
                                                    </DropdownMenuItem>
                                                )}
                                                {onAddFeed && (
                                                    <DropdownMenuItem
                                                        onClick={() => onAddFeed(folderId)}
                                                    >
                                                        Add Feed
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </div>
                            </div>

                            {/* Preview banner for unsubscribed feeds - mobile */}
                            {shouldShowPreviewBanner && (
                                <FeedPreviewBanner
                                    feedTitle={feedData?.title}
                                    feedDescription={feedData?.description}
                                    onFollow={() => setIsSubscriptionModalOpen(true)}
                                />
                            )}

                            <ArticlesList
                                articles={filteredArticles}
                                selectedArticleId={selectedArticleId}
                                isLoading={isArticlesLoading}
                                isFetching={isFetching}
                                hasNextPage={hasNextPage}
                                showUnreadOnly={showUnreadOnly}
                                isRecentlyReadMode={isRecentlyReadMode}
                                isReadLaterMode={isReadLaterMode}
                                onLoadMore={fetchNextPage}
                                onArticleSelect={handleArticleSelect}
                            />
                        </div>
                    )}
                </div>
            ) : (
                // Desktop: Resizable panels with proper toolbar structure
                <div className="hidden md:flex w-full">
                    <ResizablePanelGroup direction="horizontal">
                        <ResizablePanel defaultSize={35} minSize={20} maxSize={60}>
                            <div className="flex h-full flex-col border-r">
                                {/* Desktop List Toolbar */}
                                <div className="flex h-14 items-center justify-between border-b px-4">
                                    <div className="flex items-center space-x-2 min-w-0 flex-1">
                                        {isTablet && (
                                            <SidebarLeftTrigger className="-ml-1" />
                                        )}
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
                                            <Badge variant="outline" className="min-w-3 px-1 flex-shrink-0">
                                                {unreadCount}
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
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

                                        {/* Direct refresh button */}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => handleRefresh(false)}
                                            disabled={isDeepRefreshing}
                                            title="Refresh articles"
                                        >
                                            <RefreshCw
                                                className={`h-4 w-4 ${isDeepRefreshing ? "animate-spin" : ""}`}
                                            />
                                        </Button>

                                        {/* More actions - hide for preview feeds */}
                                        {!shouldShowPreviewBanner && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                    >
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem
                                                        onClick={() => handleRefresh(true)}
                                                        disabled={isDeepRefreshing}
                                                    >
                                                        <RefreshCw className="h-4 w-4 mr-2" />
                                                        Force Refresh
                                                    </DropdownMenuItem>
                                                    {onCreateFolder && (
                                                        <DropdownMenuItem onClick={onCreateFolder}>
                                                            Create Folder
                                                        </DropdownMenuItem>
                                                    )}
                                                    {onAddFeed && (
                                                        <DropdownMenuItem
                                                            onClick={() => onAddFeed(folderId)}
                                                        >
                                                            Add Feed
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                    </div>
                                </div>

                                {/* Preview banner for unsubscribed feeds - desktop */}
                                {shouldShowPreviewBanner && (
                                    <FeedPreviewBanner
                                        feedTitle={feedData?.title}
                                        feedDescription={feedData?.description}
                                        onFollow={() => setIsSubscriptionModalOpen(true)}
                                    />
                                )}

                                <ArticlesList
                                    articles={filteredArticles}
                                    selectedArticleId={selectedArticleId}
                                    isLoading={isArticlesLoading}
                                    isFetching={isFetching}
                                    hasNextPage={hasNextPage}
                                    showUnreadOnly={showUnreadOnly}
                                    isRecentlyReadMode={isRecentlyReadMode}
                                    isReadLaterMode={isReadLaterMode}
                                    onLoadMore={fetchNextPage}
                                    onArticleSelect={handleArticleSelect}
                                />
                            </div>
                        </ResizablePanel>

                        <ResizableHandle />

                        <ResizablePanel defaultSize={65} minSize={50}>
                            {selectedArticle ? (
                                <ArticleContent
                                    article={selectedArticle as Article}
                                    currentContent={currentContent}
                                    currentReadTime={currentReadTime}
                                    isShowingSummary={isShowingSummary}
                                    isTranslating={isTranslating}
                                    isRecentlyReadMode={isRecentlyReadMode}
                                    isReadLaterMode={isReadLaterMode}
                                    shouldShowPreviewBanner={shouldShowPreviewBanner}
                                    onContentChange={handleContentChange}
                                    onReadTimeChange={handleReadTimeChange}
                                    onSummaryChange={handleSummaryChange}
                                    onTranslationChange={handleTranslationChange}
                                    onMarkAsRead={handleMarkAsRead}
                                    onArticleRemoved={handleArticleRemoved}
                                />
                            ) : (
                                <div className="flex h-full items-center justify-center text-muted-foreground">
                                    <div className="text-center">
                                        <p className="text-lg">
                                            Select an article to read
                                        </p>
                                        <p className="text-sm">
                                            Choose from the articles list to get
                                            started
                                        </p>
                                    </div>
                                </div>
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
                />
            )}
        </div>
    )
}