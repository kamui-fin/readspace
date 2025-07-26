"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import type { Article, PaginatedResponse } from "@/lib/api/hooks/feeds"
import {
    useArticles,
    useArticle,
    useUpdateArticle,
    useFeeds,
    useRefreshFeed,
    useRefreshFolderFeeds,
    useRefreshAllFeeds,
    useRefreshStatus,
    useRecentlyReadArticles,
    useReadLaterArticles,
    useUnreadCounts,
} from "@/lib/api/hooks/feeds"
import { format, formatDistanceToNow, parseISO } from "date-fns"
import {
    BookmarkIcon,
    CalendarIcon,
    CheckCircle2,
    Clock,
    Eye,
    EyeOff,
    Paperclip,
    RefreshCw,
    Globe,
    Check,
    MoreVertical,
    Loader2,
} from "lucide-react"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { toast } from "react-hot-toast"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import InfiniteScroll from "react-infinite-scroll-component"

export function ArticlesView({
    initialSidebarTitle,
    feedId,
    folderId,
    libraryId,
    publishedSince,
    publishedUntil,
    mode = "allArticles",
}: {
    initialSidebarTitle?: string
    feedId?: string
    folderId?: string
    libraryId?: string
    publishedSince?: string
    publishedUntil?: string
    mode?: "allArticles" | "recentlyRead" | "readLater"
}) {
    const {
        initialSidebarTitle: viewInitialSidebarTitle,
        feedId: viewFeedId,
        folderId: viewFolderId,
        libraryId: viewLibraryId,
        publishedSince: viewPublishedSince,
        publishedUntil: viewPublishedUntil,
        mode: viewMode = "allArticles",
    } = {
        initialSidebarTitle,
        feedId,
        folderId,
        libraryId,
        publishedSince,
        publishedUntil,
        mode,
    }
    const [page, setPage] = useState(1)
    const [selectedArticleId, setSelectedArticleId] = useState<string | null>(
        null
    )
    const [showUnreadOnly, setShowUnreadOnly] = useState(false)
    const [refreshTaskId, setRefreshTaskId] = useState<string | null>(null)
    const [refreshType, setRefreshType] = useState<"folder" | "all" | null>(
        null
    )
    const [isDeepRefreshing, setIsDeepRefreshing] = useState(false)
    const [allArticles, setAllArticles] = useState<Article[]>([])
    const [hasMorePages, setHasMorePages] = useState(true)
    const router = useRouter()
    const { data: allUserFeeds } = useFeeds()
    const { data: unreadCounts } = useUnreadCounts()

    const typedAllUserFeeds = (allUserFeeds as any[]) || []
    const typedUnreadCounts =
        (unreadCounts as {
            total_unread?: number
            unread_by_folder?: Array<{
                folder_id: string
                unread_count: number
            }>
        }) || {}

    const isRecentlyReadMode = viewMode === "recentlyRead"
    const isReadLaterMode = viewMode === "readLater"
    const sidebarTitle = isRecentlyReadMode
        ? "Recently Read"
        : isReadLaterMode
          ? "Read Later"
          : viewInitialSidebarTitle || "All Articles"

    // Base params without unread filter for server requests
    const baseArticlesParams = {
        publishedSince: viewPublishedSince,
        publishedUntil: viewPublishedUntil,
        page,
        size: 25,
        sortBy: "published_at",
        sortOrder: "desc",
        // Remove isRead from server params - we'll filter client-side
    }

    let queryKeyParams: any
    let articlesHook

    if (isRecentlyReadMode) {
        queryKeyParams = { 
            page, 
            size: 25,
            mode: 'recently_read'
        }
        articlesHook = useRecentlyReadArticles
    } else if (isReadLaterMode) {
        queryKeyParams = { 
            page, 
            size: 25,
            mode: 'read_later'
        }
        articlesHook = useReadLaterArticles
    } else {
        if (viewFolderId) {
            queryKeyParams = {
                ...baseArticlesParams,
                folderId: viewFolderId,
                feedIds: undefined,
                viewType: 'folder',
                viewId: viewFolderId, // Add explicit view identifier
            }
        } else if (viewFeedId) {
            queryKeyParams = {
                ...baseArticlesParams,
                feedIds: [viewFeedId],
                folderId: undefined,
                viewType: 'feed',
                viewId: viewFeedId, // Add explicit view identifier
            }
        } else {
            queryKeyParams = {
                ...baseArticlesParams,
                feedIds: undefined,
                folderId: undefined,
                viewType: 'all',
                viewId: 'all', // Add explicit view identifier
            }
        }
        articlesHook = useArticles
    }

    const {
        data,
        isLoading: isArticlesLoading,
        isFetching,
        refetch: refetchArticles,
    } = articlesHook(queryKeyParams, {
        keepPreviousData: true, // Restore for better UX
        refetchOnMount: false,
        refetchOnWindowFocus: false,
    })

    // Transform API response to match expected structure
    const articlesData: PaginatedResponse<Article> = useMemo(() => {
        if (!data) {
            return {
                items: [],
                total: 0,
                page: 1,
                pages: 1,
                size: 25,
            }
        }

        const apiData = data as any
        // Handle both old and new API response formats
        if (apiData.items) {
            // Already in expected format
            return apiData
        } else if (apiData.articles) {
            // Transform from API format to expected format
            return {
                items: apiData.articles.map((article: any) => ({
                    ...article,
                    link: article.url || article.link,
                    description: article.description || null,
                    image_url: article.image_url || null,
                    created_at: article.created_at || new Date().toISOString(),
                    updated_at: article.updated_at || new Date().toISOString(),
                    user_id: article.user_id || "",
                    guid: article.guid || article.id,
                    estimated_read_time_minutes:
                        article.estimated_read_time_minutes || null,
                    custom_metadata: article.custom_metadata || null,
                    feed: article.feed || {
                        id: article.feed_id || null,
                        title: article.feed_title || null,
                        url: null,
                        image_url: article.feed_image_url || null,
                    },
                    article_type: article.article_type || "feed",
                    priority: article.priority || null,
                    note: article.note || null,
                })),
                total: apiData.total,
                page: apiData.page,
                pages: apiData.total_pages || apiData.pages || 1,
                size: apiData.size,
            }
        } else {
            // Fallback
            return {
                items: [],
                total: 0,
                page: 1,
                pages: 1,
                size: 25,
            }
        }
    }, [data])

    // Update allArticles when new data comes in
    useEffect(() => {
        if (page === 1) {
            // Fresh load or refresh - always replace all articles (even if empty)
            setAllArticles(articlesData.items)
            setHasMorePages(articlesData.pages > 1)
        } else if (articlesData.items.length > 0) {
            // Loading more pages - append new articles
            setAllArticles(prev => {
                const existingIds = new Set(prev.map(a => a.id))
                const newArticles = articlesData.items.filter(a => !existingIds.has(a.id))
                return [...prev, ...newArticles]
            })
            setHasMorePages(page < articlesData.pages)
        }
    }, [articlesData, page])

    // Client-side filtered articles based on unread toggle
    const filteredArticles = useMemo(() => {
        if (showUnreadOnly) {
            return allArticles.filter(article => !article.is_read)
        }
        return allArticles
    }, [allArticles, showUnreadOnly])

    const refreshFeed = useRefreshFeed()
    const refreshFolderFeeds = useRefreshFolderFeeds()
    const refreshAllFeeds = useRefreshAllFeeds()

    const { data: refreshStatus } = useRefreshStatus(
        refreshTaskId,
        !!refreshTaskId
    )

    const { data: selectedArticle, isLoading: isArticleLoading } = useArticle(
        selectedArticleId || ""
    )

    // Transform selected article to match expected Article type
    const transformedSelectedArticle: Article | null = useMemo(() => {
        if (!selectedArticle) return null

        const article = selectedArticle as any
        return {
            ...article,
            link: article.url || article.link,
            description: article.description || null,
            image_url: article.image_url || null,
            created_at: article.created_at || new Date().toISOString(),
            updated_at: article.updated_at || new Date().toISOString(),
            user_id: article.user_id || "",
            guid: article.guid || article.id,
            estimated_read_time_minutes:
                article.estimated_read_time_minutes || null,
            custom_metadata: article.custom_metadata || null,
            feed: article.feed || {
                id: article.feed_id || null,
                title: article.feed_title || null,
                url: null,
                image_url: article.feed_image_url || null,
            },
            article_type: article.article_type || "feed",
            priority: article.priority || null,
            note: article.note || null,
        }
    }, [selectedArticle])
    const updateArticle = useUpdateArticle()

    // Function to fetch more articles for infinite scroll
    const fetchMoreArticles = useCallback(() => {
        if (!isFetching && hasMorePages) {
            setPage(prevPage => prevPage + 1)
        }
    }, [isFetching, hasMorePages])

    useEffect(() => {
        if (filteredArticles.length > 0 && !selectedArticleId) {
            setSelectedArticleId(filteredArticles[0].id)
        }
    }, [filteredArticles, selectedArticleId])

    // Clear selected article if it's no longer in the articles list (e.g., removed from read later)
    useEffect(() => {
        if (selectedArticleId && filteredArticles.length > 0) {
            const selectedArticleExists = filteredArticles.some(
                (article) => article.id === selectedArticleId
            )
            if (!selectedArticleExists) {
                setSelectedArticleId(null)
            }
        }
    }, [selectedArticleId, filteredArticles])

    useEffect(() => {
        if (!isRecentlyReadMode && !isReadLaterMode) {
            setPage(1)
            setSelectedArticleId(null)
            setAllArticles([])
        }
    }, [
        viewFeedId,
        viewFolderId,
        viewPublishedSince,
        viewPublishedUntil,
        isRecentlyReadMode,
        isReadLaterMode,
    ])

    useEffect(() => {
        if (isRecentlyReadMode || isReadLaterMode) {
            setPage(1)
            setAllArticles([])
        }
    }, [isRecentlyReadMode, isReadLaterMode])

    // Handle refresh status updates
    useEffect(() => {
        if (refreshStatus && typeof refreshStatus === "object") {
            const status = (refreshStatus as any).status
            if (status === "completed") {
                const result = (refreshStatus as any).result
                if (result) {
                    let message = `Refresh completed! ${result.refreshed_count} feeds refreshed successfully`

                    if (result.failed_count > 0) {
                        message += `, ${result.failed_count} failed`

                        // Add error summary if available
                        if (result.error_summary) {
                            const errorTypes = Object.entries(
                                result.error_summary
                            )
                                .map(([type, count]: [string, any]) => {
                                    const typeLabels: Record<string, string> = {
                                        timeout: "timeouts",
                                        not_found: "404s",
                                        access_denied: "access denied",
                                        server_error: "server errors",
                                        parse_error: "invalid feeds",
                                        connection_error: "connection issues",
                                        data_error: "data type errors",
                                        other: "other errors",
                                    }
                                    return `${count} ${typeLabels[type] || type}`
                                })
                                .join(", ")
                            message += ` (${errorTypes})`
                        }
                    }

                    message += "."

                    toast.success(message, {
                        id: "bulk-refresh",
                        duration: result.failed_count > 0 ? 8000 : 4000, // Show longer if there were failures
                    })
                } else {
                    toast.success("Refresh completed!", { id: "bulk-refresh" })
                }
                setRefreshTaskId(null)
                setRefreshType(null)
                refetchArticles()
            } else if (status === "failed") {
                toast.error("Refresh failed. Please try again.", {
                    id: "bulk-refresh",
                })
                setRefreshTaskId(null)
                setRefreshType(null)
            } else if (status === "in_progress") {
                const progress = (refreshStatus as any).progress
                if (progress) {
                    const refreshLabel =
                        refreshType === "folder" ? "folder feeds" : "feeds"
                    let progressMessage = `Refreshing ${refreshLabel}: ${progress.completed}/${progress.total} completed`

                    if (progress.successful > 0 || progress.failed > 0) {
                        progressMessage += ` (${progress.successful} successful`
                        if (progress.failed > 0) {
                            progressMessage += `, ${progress.failed} failed`
                        }
                        progressMessage += ")"
                    }

                    toast.loading(progressMessage, {
                        id: "bulk-refresh",
                        duration: 0,
                    })
                }
            }
        }
    }, [refreshStatus, refreshType, refetchArticles])

    const groupedArticles = useMemo(() => {
        if (isRecentlyReadMode || filteredArticles.length === 0) {
            return {}
        }
        const groups: Record<string, { label: string; articles: Article[] }> =
            {}
        filteredArticles.forEach((article: Article) => {
            if (!article.published_at) return
            const date = parseISO(article.published_at)
            const today = new Date()
            const yesterday = new Date()
            yesterday.setDate(today.getDate() - 1)
            let dateGroup: string
            let dateLabel: string
            if (date.toDateString() === today.toDateString()) {
                dateGroup = "today"
                dateLabel = "Today"
            } else if (date.toDateString() === yesterday.toDateString()) {
                dateGroup = "yesterday"
                dateLabel = "Yesterday"
            } else {
                dateGroup = format(date, "yyyy-MM-dd")
                dateLabel = format(date, "EEEE, MMMM d")
            }
            if (!groups[dateGroup]) {
                groups[dateGroup] = {
                    label: dateLabel,
                    articles: [],
                }
            }
            groups[dateGroup].articles.push(article)
        })
        return groups
    }, [filteredArticles, isRecentlyReadMode])

    const handleArticleClick = (articleId: string) => {
        setSelectedArticleId(articleId)
        const article = filteredArticles.find(
            (a: Article) => a.id === articleId
        )
        if (!isRecentlyReadMode && article && !article.is_read) {
            // Update the article in the UI optimistically
            setAllArticles(prev => prev.map(item => 
                item.id === articleId ? { ...item, is_read: true } : item
            ))

            // Then perform the actual update
            updateArticle.mutate({
                articleId,
                data: { is_read: true },
            })
        }
    }

    // Simplified refresh: always shallow refresh (just refetch from DB)
    const handleShallowRefresh = async () => {
        toast.loading("Refreshing articles...", { id: "shallow-refresh" })
        try {
            setPage(1)
            setAllArticles([])
            await refetchArticles()
            toast.success("Articles refreshed!", { id: "shallow-refresh" })
        } catch (error) {
            console.error("Shallow refresh failed:", error)
            toast.error("Failed to refresh articles. Please try again.", {
                id: "shallow-refresh",
            })
        }
    }

    // Refresh with custom message
    const handleRefreshWithMessage = async (message: string) => {
        toast.loading(message, { id: "refresh" })
        try {
            setPage(1)
            setAllArticles([])
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
        if (!viewFeedId) return

        setIsDeepRefreshing(true)
        toast.loading("Checking for new articles...", { id: "deep-refresh" })

        try {
            await refreshFeed.mutateAsync({
                feedId: viewFeedId,
                forceRefetch: true,
                silent: true, // We'll handle our own toasts
            })
            // After deep refresh completes, do a shallow refresh to get the new articles
            setPage(1)
            setAllArticles([])
            refetchArticles()
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
        // No need to reset page or refetch - we're filtering client-side now!
    }

    // Calculate unread count for the badge based on current view
    const unreadCount = useMemo(() => {
        // Don't show unread count for special modes
        if (isRecentlyReadMode || isReadLaterMode) return 0

        if (viewFeedId) {
            // Individual feed: get unread count from the feed data
            const currentFeed = typedAllUserFeeds.find(
                (f) => f.id === viewFeedId
            )
            return currentFeed?.unread_count || 0
        } else if (viewFolderId) {
            // Folder view: get unread count for this folder
            const folderUnreadCount =
                typedUnreadCounts?.unread_by_folder?.find(
                    (item) => item.folder_id === viewFolderId
                )?.unread_count || 0
            return folderUnreadCount
        } else {
            // All articles view: get total unread count
            return typedUnreadCounts?.total_unread || 0
        }
    }, [
        viewFeedId,
        viewFolderId,
        typedAllUserFeeds,
        typedUnreadCounts,
        isRecentlyReadMode,
        isReadLaterMode,
    ])

    if (isArticlesLoading && allArticles.length === 0) {
        return (
            <div className="flex h-[calc(100vh-1rem)] w-full bg-background rounded-xl  shadow-sm">
                <div className="w-full flex flex-col gap-4 p-8">
                    <ArticleItemSkeleton />
                    <ArticleItemSkeleton />
                    <ArticleItemSkeleton />
                </div>
            </div>
        )
    }

    if (!isArticlesLoading && filteredArticles.length === 0 && allArticles.length === 0) {
        return (
            <div className="flex h-[calc(100vh-1rem)] w-full bg-background rounded-xl  shadow-sm">
                <div className="w-full flex flex-col items-center justify-center gap-4">
                    <p className="text-muted-foreground">
                        {isRecentlyReadMode
                            ? "No recently read articles"
                            : isReadLaterMode
                                ? "No articles in your Read Later list"
                                : "No articles found"}
                    </p>
                    {/* Always show toggle if in a mode that supports it, or refresh otherwise */}
                    {!isRecentlyReadMode &&
                    !isReadLaterMode &&
                    (viewMode === "allArticles" ||
                        viewFeedId ||
                        viewFolderId) ? (
                        <div className="flex flex-col items-center gap-2">
                            <Button
                                variant="outline"
                                onClick={() =>
                                    handleRefreshWithMessage(
                                        "Refreshing articles..."
                                    )
                                }
                            >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Refresh
                            </Button>
                        </div>
                    ) : isRecentlyReadMode || isReadLaterMode ? (
                        <Button
                            variant="outline"
                            onClick={() => router.push("/articles")}
                        >
                            Browse Articles
                        </Button>
                    ) : (
                        <Button
                            variant="outline"
                            onClick={() =>
                                handleRefreshWithMessage(
                                    "Refreshing articles..."
                                )
                            }
                        >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Refresh
                        </Button>
                    )}
                </div>
            </div>
        )
    }

    if (filteredArticles.length === 0 && allArticles.length > 0) {
        // Show message when filtering hides all articles
        return (
            <div className="flex h-[calc(100vh-1rem)] w-full bg-background rounded-xl shadow-sm">
                <div className="w-full flex flex-col items-center justify-center gap-4">
                    <p className="text-muted-foreground">
                        No unread articles found matching your filters.
                    </p>
                    <Button
                        variant="outline"
                        onClick={toggleShowUnreadOnly}
                    >
                        Show All Articles
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-[calc(100vh-1rem)] w-full bg-background rounded-xl shadow-sm">
            <ResizablePanelGroup direction="horizontal">
                <ResizablePanel defaultSize={35} minSize={15} maxSize={40}>
                    <div className="flex h-full flex-col border-r">
                        <div className="flex h-14 items-center justify-between border-b px-4">
                            <div className="flex items-center space-x-2 min-w-0 flex-1">
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
                                {!isRecentlyReadMode &&
                                    !isReadLaterMode &&
                                    unreadCount > 0 && (
                                        <Badge
                                            variant="outline"
                                            className="min-w-3 px-1 flex-shrink-0"
                                        >
                                            {unreadCount}
                                        </Badge>
                                    )}
                            </div>
                            <div className="flex items-center gap-1">
                                {!isRecentlyReadMode && !isReadLaterMode ? (
                                    // Full controls for default article views (All, Folder, Feed)
                                    <>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={toggleShowUnreadOnly}
                                            title={
                                                showUnreadOnly
                                                    ? "Show all articles"
                                                    : "Show unread only"
                                            }
                                        >
                                            {showUnreadOnly ? (
                                                <Eye className="h-4 w-4" />
                                            ) : (
                                                <EyeOff className="h-4 w-4" />
                                            )}
                                        </Button>
                                        {/* Individual feed: split button with shallow + deep refresh */}
                                        {viewFeedId ? (
                                            <div className="flex">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 rounded-r-none border-r border-border/50"
                                                    onClick={() =>
                                                        handleRefreshWithMessage(
                                                            "Quick refresh..."
                                                        )
                                                    }
                                                    title="Quick refresh"
                                                    disabled={isDeepRefreshing}
                                                >
                                                    <RefreshCw className="h-4 w-4" />
                                                </Button>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger
                                                        asChild
                                                    >
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-4 rounded-l-none px-1"
                                                            title="More refresh options"
                                                            disabled={
                                                                isDeepRefreshing
                                                            }
                                                        >
                                                            <MoreVertical className="h-3 w-3" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem
                                                            onClick={() =>
                                                                handleRefreshWithMessage(
                                                                    "Quick refresh..."
                                                                )
                                                            }
                                                        >
                                                            <RefreshCw className="mr-2 h-4 w-4" />
                                                            Quick Refresh
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={
                                                                handleDeepRefresh
                                                            }
                                                            disabled={
                                                                isDeepRefreshing
                                                            }
                                                        >
                                                            <Globe className="mr-2 h-4 w-4" />
                                                            {isDeepRefreshing
                                                                ? "Checking..."
                                                                : "Check for New Articles"}
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        ) : (
                                            /* Other views: simple refresh button (shallow only) */
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() =>
                                                    handleRefreshWithMessage(
                                                        "Refreshing articles..."
                                                    )
                                                }
                                                title="Refresh"
                                            >
                                                <RefreshCw className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </>
                                ) : (
                                    // Minimal controls (Refresh only) for special views like Recently Read, Read Later
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => {
                                            if (isRecentlyReadMode) {
                                                handleRefreshWithMessage(
                                                    "Refreshing recently read..."
                                                )
                                            } else if (isReadLaterMode) {
                                                handleRefreshWithMessage(
                                                    "Refreshing read later..."
                                                )
                                            } else {
                                                handleRefreshWithMessage(
                                                    "Refreshing articles..."
                                                )
                                            }
                                        }}
                                        title="Refresh"
                                    >
                                        <RefreshCw className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div 
                            id="articles-scroll-container"
                            className="flex-1 overflow-auto"
                        >
                            <InfiniteScroll
                                dataLength={filteredArticles.length}
                                next={fetchMoreArticles}
                                hasMore={hasMorePages}
                                loader={
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                    </div>
                                }
                                endMessage={
                                    <div className="text-center py-6 text-muted-foreground text-sm">
                                        <b>You've seen all articles!</b>
                                    </div>
                                }
                                scrollableTarget="articles-scroll-container"
                            >
                                {isRecentlyReadMode || isReadLaterMode
                                    ? filteredArticles.map(
                                          (article: Article, index: number) => (
                                              <ArticleItem
                                                  key={article.id}
                                                  article={article}
                                                  isActive={
                                                      article.id ===
                                                      selectedArticleId
                                                  }
                                                  isLastInGroup={
                                                      index ===
                                                      filteredArticles.length -
                                                          1
                                                  }
                                                  onClick={() =>
                                                      handleArticleClick(
                                                          article.id
                                                      )
                                                  }
                                                  isRecentlyReadMode={
                                                      isRecentlyReadMode
                                                  }
                                                  isReadLaterMode={
                                                      isReadLaterMode
                                                  }
                                              />
                                          )
                                      )
                                    : Object.entries(groupedArticles).map(
                                          ([groupId, group]) => (
                                              <div key={groupId}>
                                                  <div className="px-3 py-2.5 sticky top-0 bg-background/95 backdrop-blur-sm z-10 mt-3 first:mt-1.5">
                                                      <div className="flex items-center gap-2">
                                                          {group.label ===
                                                              "Today" ||
                                                          group.label ===
                                                              "Yesterday" ? (
                                                              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                                                          ) : (
                                                              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                                          )}
                                                          <span className="text-xs font-medium text-muted-foreground">
                                                              {group.label}
                                                          </span>
                                                      </div>
                                                  </div>
                                                  {group.articles.map(
                                                      (
                                                          article: Article,
                                                          index: number
                                                      ) => (
                                                          <ArticleItem
                                                              key={article.id}
                                                              article={article}
                                                              isActive={
                                                                  article.id ===
                                                                  selectedArticleId
                                                              }
                                                              isLastInGroup={
                                                                  index ===
                                                                  group.articles
                                                                      .length -
                                                                      1
                                                              }
                                                              onClick={() =>
                                                                  handleArticleClick(
                                                                      article.id
                                                                  )
                                                              }
                                                          />
                                                      )
                                                  )}
                                              </div>
                                          )
                                      )}
                            </InfiniteScroll>
                        </div>
                    </div>
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel defaultSize={75} className="overflow-hidden">
                    <div className="flex flex-col h-full">
                        {isArticleLoading && (
                            <div className="flex-1 p-8">
                                <ArticleContentSkeleton />
                            </div>
                        )}
                        {!isArticleLoading && transformedSelectedArticle ? (
                            <div className="p-6 md:p-10 h-full overflow-y-auto">
                                <ArticleContentView
                                    article={transformedSelectedArticle}
                                    isRecentlyReadMode={isRecentlyReadMode}
                                    isReadLaterMode={isReadLaterMode}
                                    onArticleRemoved={() =>
                                        setSelectedArticleId(null)
                                    }
                                />
                            </div>
                        ) : null}
                        {!isArticleLoading && !transformedSelectedArticle && (
                            <div className="flex flex-1 items-center justify-center">
                                <p className="text-muted-foreground">
                                    Select an article to read
                                </p>
                            </div>
                        )}
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    )
}

function ArticleItemSkeleton() {
    return (
        <div className="flex gap-3 py-2.5 px-3 animate-pulse">
            <div className="flex-1 space-y-1.5 min-w-0">
                <div className="flex items-center gap-2">
                    <div className="h-2 w-20 bg-muted rounded" />
                    <div className="h-2 w-16 bg-muted rounded" />
                </div>
                <div className="h-4 w-5/6 bg-muted rounded" />
                <div className="h-3 w-1/2 bg-muted/70 rounded" />
                <div className="h-3 w-full bg-muted/70 rounded" />
            </div>
            <div className="h-16 w-16 bg-muted/30 rounded-md" />
        </div>
    )
}

function ArticleContentSkeleton() {
    return (
        <div className="mx-auto max-w-3xl space-y-6 animate-pulse">
            <div className="h-8 bg-muted rounded w-3/4 mb-2"></div>
            <div className="flex items-center gap-2 mb-6">
                <div className="h-6 w-6 rounded-full bg-muted" />
                <div className="h-3 bg-muted rounded w-24" />
                <div className="h-3 bg-muted rounded w-16" />
                <div className="h-3 bg-muted rounded w-32" />
            </div>
            <div className="aspect-video w-full rounded-lg bg-muted/30 mb-6"></div>
            <div className="space-y-3">
                <div className="h-4 bg-muted rounded w-full"></div>
                <div className="h-4 bg-muted rounded w-full"></div>
                <div className="h-4 bg-muted rounded w-5/6"></div>
            </div>
            <div className="space-y-3">
                <div className="h-4 bg-muted/70 rounded w-full"></div>
                <div className="h-4 bg-muted/70 rounded w-full"></div>
                <div className="h-4 bg-muted/70 rounded w-4/6"></div>
            </div>
        </div>
    )
}

function ArticleContentView({
    article,
    isRecentlyReadMode,
    isReadLaterMode,
    onArticleRemoved,
}: {
    article: Article
    isRecentlyReadMode?: boolean
    isReadLaterMode?: boolean
    onArticleRemoved?: () => void
}) {
    const updateArticle = useUpdateArticle()
    const { resolvedTheme } = useTheme()
    const [optimisticReadLater, setOptimisticReadLater] = useState(
        article.is_read_later
    )
    const contentRef = useRef<HTMLDivElement>(null)
    const [hasMarkedRead, setHasMarkedRead] = useState(article.is_read)
    const [imageError, setImageError] = useState(false)

    const handleToggleReadLater = () => {
        const newReadLaterState = !optimisticReadLater
        setOptimisticReadLater(newReadLaterState)
        
        // Show toast immediately for instant feedback
        toast.success(
            newReadLaterState 
                ? "Article saved to Read Later" 
                : "Article removed from Read Later"
        )
        
        updateArticle.mutate({
            articleId: article.id,
            data: { is_read_later: newReadLaterState },
        }, {
            onError: () => {
                // Revert optimistic update on error and show error
                setOptimisticReadLater(!newReadLaterState)
                toast.error("Failed to update article. Please try again.")
            }
        })
    }

    const handleMarkAsRead = () => {
        // Show instant feedback
        toast.success("Article marked as read")
        
        // Mark as read and remove from read later
        updateArticle.mutate(
            {
                articleId: article.id,
                data: { is_read: true, is_read_later: false },
            },
            {
                onSuccess: () => {
                    // If we're in read later mode, clear the selected article since it will be removed from the list
                    if (isReadLaterMode) {
                        onArticleRemoved?.()
                    }
                },
                onError: () => {
                    toast.error("Failed to mark article as read. Please try again.")
                }
            }
        )
    }

    useEffect(() => {
        // Update optimistic state when article changes
        setOptimisticReadLater(article.is_read_later)
    }, [article.is_read_later])

    useEffect(() => {
        if (
            isRecentlyReadMode ||
            isReadLaterMode ||
            !contentRef.current ||
            hasMarkedRead
        )
            return
        const el = contentRef.current
        const handleScroll = () => {
            if (el.scrollHeight - el.scrollTop - el.clientHeight <= 1) {
                if (!hasMarkedRead) {
                    // Set optimistic UI update first
                    setHasMarkedRead(true)

                    // Then perform the actual update
                    updateArticle.mutate({
                        articleId: article.id,
                        data: { is_read: true },
                    })
                }
            }
        }
        el.addEventListener("scroll", handleScroll)
        return () => el.removeEventListener("scroll", handleScroll)
    }, [
        article.id,
        hasMarkedRead,
        updateArticle,
        isRecentlyReadMode,
        isReadLaterMode,
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
                                            toast.success("Article removed from Read Later")
                                            updateArticle.mutate({
                                                articleId: article.id,
                                                data: { is_read_later: false },
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
    }, [article.id, hasMarkedRead, updateArticle, isReadLaterMode])

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

    return (
        <article className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-3">
                <h1 className="text-2xl font-semibold">{article.title}</h1>
            </div>
            <div className="flex items-center justify-between mb-6 text-[10px]">
                <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                        <AvatarImage
                            src={
                                article.feed?.image_url ||
                                article.image_url ||
                                "/placeholders/avatar.png"
                            }
                        />
                        <AvatarFallback>
                            {article.feed?.title?.substring(0, 2) || "N/A"}
                        </AvatarFallback>
                    </Avatar>
                    <span className="truncate max-w-[200px]">
                        {article.author ||
                            article.feed?.title ||
                            "Unknown Source"}
                    </span>
                    <span className="text-muted-foreground before:content-['•'] before:ml-1 before:mr-2">
                        {publishedAtDisplay}
                    </span>
                    {article.estimated_read_time_minutes != null && (
                        <span className="text-muted-foreground before:content-['•'] before:ml-1 before:mr-2">
                            {article.estimated_read_time_minutes} min read
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {article.link && (
                        <a
                            href={article.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline focus:underline cursor-pointer"
                            tabIndex={0}
                        >
                            Open original article
                        </a>
                    )}
                    {isReadLaterMode ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 rounded-full hover:bg-muted"
                            onClick={handleMarkAsRead}
                        >
                            <Check className="h-4 w-4" />
                            <span className="sr-only">Mark as read</span>
                        </Button>
                    ) : (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 rounded-full hover:bg-muted"
                            onClick={handleToggleReadLater}
                        >
                            <BookmarkIcon
                                className={`h-4 w-4 ${optimisticReadLater ? "fill-primary text-primary" : ""}`}
                            />
                            <span className="sr-only">
                                {optimisticReadLater
                                    ? "Remove from read later"
                                    : "Save for later"}
                            </span>
                        </Button>
                    )}
                </div>
            </div>
            <div className="space-y-6">
                {article.image_url && !imageError && (
                    <div className="aspect-video w-3/4 mx-auto overflow-hidden rounded-lg bg-primary/5 mb-6">
                        <img
                            src={article.image_url}
                            alt={article.title || "Article image"}
                            className="w-full h-full object-cover"
                            onError={() => setImageError(true)}
                        />
                    </div>
                )}
                {/* {article.description && (
                    <div
                        className="dark:prose-invert max-w-none prose-blockquote:border-l-4 prose-blockquote:border-primary/20 prose-blockquote:pl-4 prose-blockquote:py-1 prose-blockquote:my-2 prose-blockquote:bg-muted/30 prose-blockquote:rounded-r-md"
                        dangerouslySetInnerHTML={{ __html: `<blockquote>${article.description}</blockquote>` }}
                        style={{
                            fontFamily: 'var(--font-garamond-serif)'
                        }}
                    />
                )} */}
                {article.content && (
                    <div
                        ref={contentRef}
                        className="article-content prose prose-lg dark:prose-invert max-w-none 
                          prose-headings:font-semibold prose-h1:text-xl prose-h2:text-lg
                          prose-p:leading-relaxed prose-a:text-primary prose-a:no-underline prose-a:hover:underline
                          prose-img:rounded-md prose-img:mx-auto prose-pre:bg-muted prose-pre:p-4 prose-pre:rounded-md"
                        dangerouslySetInnerHTML={{ __html: article.content }}
                        style={{
                            fontFamily: "var(--font-garamond-serif)",
                            overflowWrap: "break-word",
                            wordWrap: "break-word",
                        }}
                    />
                )}
            </div>
        </article>
    )
}

const stripHTML = (html: string) => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")
    return doc.body.textContent || ""
}

function ArticleItem({
    article,
    isActive = false,
    isLastInGroup = false,
    onClick,
    isRecentlyReadMode = false,
    isReadLaterMode = false,
}: {
    article: Article
    isActive?: boolean
    isLastInGroup?: boolean
    onClick: () => void
    isRecentlyReadMode?: boolean
    isReadLaterMode?: boolean
}) {
    const [feedImageError, setFeedImageError] = useState(false)
    const [articleImageError, setArticleImageError] = useState(false)

    const publishedAtString = article.published_at
    const readAtString = article.read_at

    const timeDisplay = publishedAtString
        ? isRecentlyReadMode && readAtString
            ? `Read ${formatDistanceToNow(parseISO(readAtString), { addSuffix: true })}`
            : formatDistanceToNow(parseISO(publishedAtString), {
                  addSuffix: true,
              })
        : "Date unknown"

    // Get priority color for clipped articles
    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case "high":
                return "text-red-700 bg-red-100 border-red-300 dark:text-red-400 dark:bg-red-950 dark:border-red-800"
            case "medium":
                return "text-orange-700 bg-orange-100 border-orange-300 dark:text-orange-400 dark:bg-orange-950 dark:border-orange-800"
            case "low":
                return "text-green-700 bg-green-100 border-green-300 dark:text-green-400 dark:bg-green-950 dark:border-green-800"
            default:
                return "text-gray-700 bg-gray-100 border-gray-300 dark:text-gray-400 dark:bg-gray-950 dark:border-gray-800"
        }
    }

    // Extract priority for clipped articles
    const priority =
        article.article_type === "clipped" && article.priority
            ? article.priority
            : null

    return (
        <div
            className={`mx-0 py-2.5 px-3 ${!isLastInGroup ? "border-b" : ""} 
            ${!isActive ? "hover:bg-muted/80 hover:border-l-accent" : ""}
            active:bg-secondary/5
            transition-all duration-200 ease-out cursor-pointer 
            ${isActive ? "bg-secondary/5 border-l-2 border-l-secondary" : "border-l-2 border-l-transparent"}
            ${article.is_read ? "opacity-70" : ""}`}
            onClick={onClick}
        >
            <div className="flex gap-3">
                <div className="flex-1 space-y-1.5 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                            {article.article_type === "clipped" && priority && (
                                <div
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${getPriorityColor(priority)}`}
                                >
                                    <Globe className="h-2.5 w-2.5" />
                                    <span className="capitalize">
                                        {priority}
                                    </span>
                                </div>
                            )}
                            {article.feed?.image_url && !feedImageError ? (
                                <img
                                    src={article.feed.image_url}
                                    alt=""
                                    className="h-3 w-3 shrink-0 rounded"
                                    onError={() => setFeedImageError(true)}
                                />
                            ) : article.feed?.image_url ? (
                                <div className="h-3 w-3 shrink-0 rounded bg-primary/8" />
                            ) : null}
                            <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                                {article.feed?.title || "Unknown Source"}
                            </span>
                        </div>
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground whitespace-nowrap">
                            <Clock className="h-3 w-3" />
                            {timeDisplay}
                        </span>
                    </div>
                    <h3
                        className={`text-sm leading-tight truncate ${article.is_read ? "font-normal" : "font-medium"}`}
                    >
                        {article.title}
                    </h3>
                    {article.author && (
                        <div className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                            {article.author}
                        </div>
                    )}
                    {article.description && (
                        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-snug break-all">
                            {stripHTML(article.description)}
                        </p>
                    )}
                </div>
                {article.image_url && !articleImageError && (
                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-secondary/5 transition-colors">
                        <img
                            src={article.image_url}
                            alt={article.title || "Article image"}
                            className="h-full w-full object-cover"
                            onError={() => setArticleImageError(true)}
                        />
                    </div>
                )}
            </div>
        </div>
    )
}
