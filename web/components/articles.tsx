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
import { SidebarLeftTrigger } from "@/components/ui/sidebar"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import type { Article } from "@/lib/api/hooks/feeds"
import {
    useArticle,
    useFeeds,
    useInfiniteArticles,
    useInfiniteReadLaterArticles,
    useInfiniteRecentlyReadArticles,
    useInfiniteTodayArticles,
    useRefreshFeed,
    useRefreshStatus,
    useUnreadCounts,
    useUpdateArticle
} from "@/lib/api/hooks/feeds"
import { format, formatDistanceToNow, parseISO } from "date-fns"
import {
    ArrowLeft,
    BookmarkIcon,
    CalendarIcon,
    Check,
    CheckCircle2,
    Clock,
    Eye,
    EyeOff,
    Globe,
    Loader2,
    Menu,
    MoreVertical,
    Paperclip,
    RefreshCw,
} from "lucide-react"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useIsMobile, useIsTablet } from "@/hooks/use-mobile"
import { toast } from "react-hot-toast"
import useInfiniteScroll from "react-infinite-scroll-hook"
import { useClearPendingNavigation } from "@/hooks/use-navigation-state"
import { ArticlesEmptyState } from "@/components/articles/articles-empty-state"
import { ArticlesViewSkeleton } from "@/components/articles/articles-view-skeleton"

export function ArticlesView({
    initialSidebarTitle,
    feedId,
    folderId,
    libraryId,
    publishedSince,
    publishedUntil,
    mode = "allArticles",
    userTimezone,
}: {
    initialSidebarTitle?: string
    feedId?: string
    folderId?: string
    libraryId?: string
    publishedSince?: string
    publishedUntil?: string
    mode?: "allArticles" | "recentlyRead" | "readLater" | "today"
    userTimezone?: string
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
    const [selectedArticleId, setSelectedArticleId] = useState<string | null>(
        null
    )
    const [showContent, setShowContent] = useState(false)
    const [showUnreadOnly, setShowUnreadOnly] = useState(false)
    const isMobile = useIsMobile()
    const isTablet = useIsTablet()
    const [refreshTaskId, setRefreshTaskId] = useState<string | null>(null)
    const [refreshType, setRefreshType] = useState<"folder" | "all" | null>(
        null
    )
    const [isDeepRefreshing, setIsDeepRefreshing] = useState(false)
    const router = useRouter()
    const { clearPending } = useClearPendingNavigation()

    const { data: allUserFeeds } = useFeeds({}, {
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        staleTime: 5 * 60 * 1000,
    })
    const { data: unreadCounts } = useUnreadCounts(undefined, {
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        staleTime: 5 * 60 * 1000,
    })

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
    const isTodayMode = viewMode === "today"
    const sidebarTitle = isRecentlyReadMode
        ? "Recently Read"
        : isReadLaterMode
            ? "Read Later"
            : isTodayMode
                ? "Today"
                : viewInitialSidebarTitle || "All Articles"

    // Use infinite queries based on mode
    let infiniteQuery: any

    if (isRecentlyReadMode) {
        infiniteQuery = useInfiniteRecentlyReadArticles({ size: 25 }, {
            refetchOnMount: false,
            refetchOnWindowFocus: false,
            staleTime: 5 * 60 * 1000,
        })
    } else if (isReadLaterMode) {
        infiniteQuery = useInfiniteReadLaterArticles({ size: 25 }, {
            refetchOnMount: false,
            refetchOnWindowFocus: false,
            staleTime: 5 * 60 * 1000,
        })
    } else if (isTodayMode && userTimezone) {
        infiniteQuery = useInfiniteTodayArticles({ 
            userTimezone,
            size: 25 
        }, {
            refetchOnMount: false,
            refetchOnWindowFocus: false,
            staleTime: 5 * 60 * 1000,
        })
    } else {
        const params = {
            feedIds: viewFeedId ? [viewFeedId] : undefined,
            folderId: viewFolderId,
            publishedSince: viewPublishedSince,
            publishedUntil: viewPublishedUntil,
            sortBy: "published_at",
            sortOrder: "desc",
            size: 25,
            viewType: viewFolderId ? 'folder' : viewFeedId ? 'feed' : 'all',
            viewId: viewFolderId || viewFeedId || 'all',
        }

        infiniteQuery = useInfiniteArticles(params, {
            refetchOnMount: false,
            refetchOnWindowFocus: false,
            staleTime: 5 * 60 * 1000,
        })
    }

    const {
        data,
        isLoading: isArticlesLoading,
        isFetching,
        fetchNextPage,
        hasNextPage,
        refetch: refetchArticles,
    } = infiniteQuery

    // Transform and flatten all pages of articles
    const allArticles = useMemo(() => {
        if (!data?.pages) return []

        const articles = data.pages.flatMap((page: any) => {
            // Handle different API response formats
            if (page.items) {
                return page.items
            } else if (page.articles) {
                return page.articles.map((article: any) => ({
                    ...article,
                    link: article.url || article.link,
                    description: article.description || null,
                    image_url: article.image_url || null,
                    created_at: article.created_at || new Date().toISOString(),
                    updated_at: article.updated_at || new Date().toISOString(),
                    user_id: article.user_id || "",
                    guid: article.guid || article.id,
                    estimated_read_time_minutes: article.estimated_read_time_minutes || null,
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
                } as Article))
            }
            return []
        }).filter((article: any) => article && article.id) // Filter out articles without an ID to prevent key errors

        return articles
    }, [data])

    // Client-side filtered articles based on unread toggle
    const filteredArticles = useMemo(() => {
        if (showUnreadOnly) {
            return allArticles.filter((article: Article) => !article.is_read)
        }
        return allArticles
    }, [allArticles, showUnreadOnly])

    const refreshFeed = useRefreshFeed()

    const { data: refreshStatus } = useRefreshStatus(
        refreshTaskId,
        !!refreshTaskId
    )

    // Check if the selected article is in the current filtered list
    const isSelectedArticleInFilteredList = useMemo(() => {
        if (!selectedArticleId || allArticles.length === 0) return false
        const article = allArticles.find((a: Article) => a.id === selectedArticleId)
        if (!article) return false
        
        // Apply same filtering logic without recreating array
        if (showUnreadOnly && article.is_read) return false
        return true
    }, [selectedArticleId, allArticles, showUnreadOnly])

    const { data: selectedArticle, isLoading: isArticleLoading } = useArticle(
        selectedArticleId || "",
        {
            enabled: !!selectedArticleId && isSelectedArticleInFilteredList, // Only fetch when article is selected AND in current list
            refetchOnMount: false,
            refetchOnWindowFocus: false,
            staleTime: 5 * 60 * 1000, // 5 minutes - matches server prefetch staleTime
        }
    )

    // Transform selected article to match expected Article type
    const transformedSelectedArticle: Article | null = useMemo(() => {
        if (!selectedArticle) return null

        const article: any = selectedArticle
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
        if (!isFetching && hasNextPage) {
            fetchNextPage()
        }
    }, [isFetching, hasNextPage, fetchNextPage])

    const [sentinelRef] = useInfiniteScroll({
        loading: isFetching,
        hasNextPage: !!hasNextPage,
        onLoadMore: fetchMoreArticles,
        disabled: false,
        rootMargin: '0px 0px 200px 0px',
    })

    const [mobileSentinelRef] = useInfiniteScroll({
        loading: isFetching,
        hasNextPage: !!hasNextPage,
        onLoadMore: fetchMoreArticles,
        disabled: false,
        rootMargin: '0px 0px 200px 0px',
    })

    

    useEffect(() => {
        // Auto-select first article when we have articles but no current selection (desktop only)
        if (allArticles.length > 0 && !selectedArticleId && !isMobile && !showContent) {
            // Use a small timeout to ensure data has stabilized
            const timer = setTimeout(() => {
                if (allArticles.length > 0 && !selectedArticleId && !isMobile) {
                    const firstArticle = showUnreadOnly 
                        ? allArticles.find(a => !a.is_read) || allArticles[0]
                        : allArticles[0]
                    setSelectedArticleId(firstArticle.id)
                }
            }, 100)
            
            return () => clearTimeout(timer)
        }
    }, [allArticles.length, selectedArticleId, isMobile, showContent, showUnreadOnly])

    // Clear selected article if it's no longer in the articles list (e.g., removed from read later)
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
    }, [selectedArticleId, allArticles, viewFeedId, viewFolderId, isMobile])

    // Clear pending navigation state when component mounts (navigation completed)
    useEffect(() => {
        clearPending()
    }, [viewFeedId, viewFolderId, viewMode, clearPending])

    // Reset selected article when view changes (feed/folder/mode change)
    useEffect(() => {
        setSelectedArticleId(null)
        setShowContent(false) // Reset to list view on mobile
    }, [viewFeedId, viewFolderId, viewMode, publishedSince, publishedUntil])

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

    const handleArticleClick = useCallback((articleId: string) => {
        setSelectedArticleId(articleId)
        // Only auto-show content on mobile if user actually clicked
        if (isMobile) {
            setShowContent(true)
        }
        // Don't auto-mark as read on mobile click to prevent re-render loops
        if (!isMobile) {
            const article = allArticles.find(
                (a: Article) => a.id === articleId
            )
            if (!isRecentlyReadMode && article && !article.is_read) {
                // Perform the actual update - React Query will handle optimistic updates
                updateArticle.mutate({
                    articleId,
                    data: { is_read: true },
                    articleType: article.article_type,
                })
            }
        }
    }, [allArticles, isRecentlyReadMode, updateArticle, isMobile])

    // Simplified refresh: always shallow refresh (just refetch from DB)
    const handleShallowRefresh = async () => {
        toast.loading("Refreshing articles...", { id: "shallow-refresh" })
        try {
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
            // After deep refresh completes, refetch articles
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


    // Show skeleton during initial loading, even if we'll end up empty
    if (isArticlesLoading && allArticles.length === 0) {
        return <ArticlesViewSkeleton title={sidebarTitle} showUnreadBadge={false} />
    }

    if (!isArticlesLoading && filteredArticles.length === 0 && allArticles.length === 0) {
        return (
            <div className="flex h-[calc(100vh-1rem)] w-full bg-background rounded-xl shadow-sm">
                <ArticlesEmptyState
                    mode={viewMode}
                    feedId={viewFeedId}
                    folderId={viewFolderId}
                    onRefresh={() => handleRefreshWithMessage("Refreshing articles...")}
                />
            </div>
        )
    }

    if (filteredArticles.length === 0 && allArticles.length > 0) {
        // Show message when filtering hides all articles
        return (
            <div className="flex h-full md:h-[calc(100vh-1rem)] w-full bg-background md:rounded-xl md:shadow-sm">
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
        <div className="flex h-full md:h-[calc(100vh-1rem)] w-full bg-background md:rounded-xl md:shadow-sm">
            {/* Desktop: Resizable panels */}
            <div className="hidden md:flex w-full">
                <ResizablePanelGroup direction="horizontal">
                    <ResizablePanel defaultSize={35} minSize={15} maxSize={40}>
                        <div className="flex h-full flex-col border-r">
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
                                        {/* Individual feed: split button with shallow + deep refresh */}
                                        {viewFeedId ? (
                                            <div className="flex">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 rounded-r-none border-r border-border/50 transition-all duration-200 hover:scale-110 hover:bg-muted/60"
                                                    onClick={() =>
                                                        handleRefreshWithMessage(
                                                            "Quick refresh..."
                                                        )
                                                    }
                                                    title="Quick refresh"
                                                    disabled={isDeepRefreshing}
                                                >
                                                    <RefreshCw className="h-4 w-4 transition-transform duration-200 hover:rotate-180" />
                                                </Button>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger
                                                        asChild
                                                    >
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-4 rounded-l-none px-1 transition-all duration-200 hover:scale-110 hover:bg-muted/60"
                                                            title="More refresh options"
                                                            disabled={
                                                                isDeepRefreshing
                                                            }
                                                        >
                                                            <MoreVertical className="h-3 w-3 transition-transform duration-200" />
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
                                    </>
                                ) : (
                                    // Minimal controls (Refresh only) for special views like Recently Read, Read Later
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 transition-all duration-200 hover:scale-110 hover:bg-muted/60"
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
                                        <RefreshCw className="h-4 w-4 transition-transform duration-200 hover:rotate-180" />
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div
                            className="flex-1 overflow-auto min-h-0"
                        >
                            <div className="h-full overflow-visible">
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
                                                index={index}
                                            />
                                        )
                                    )
                                    : Object.entries(groupedArticles).map(
                                        ([groupId, group]) => (
                                            <div key={groupId}>
                                                <div className="px-3 py-2.5 sticky top-0 bg-background/95 backdrop-blur-sm z-10 mt-3 first:mt-1.5 transition-colors duration-200">
                                                    <div className="flex items-center gap-2">
                                                        {group.label ===
                                                            "Today" ||
                                                            group.label ===
                                                            "Yesterday" ? (
                                                            <CheckCircle2 className="h-4 w-4 text-muted-foreground transition-colors duration-200" />
                                                        ) : (
                                                            <CalendarIcon className="h-4 w-4 text-muted-foreground transition-colors duration-200" />
                                                        )}
                                                        <span className="text-xs font-medium text-muted-foreground transition-colors duration-200">
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
                                                            index={index}
                                                        />
                                                    )
                                                )}
                                            </div>
                                        )
                                    )}
                                {hasNextPage && (
                                    <div ref={sentinelRef} className="flex items-center justify-center py-8">
                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                    </div>
                                )}
                                {!hasNextPage && filteredArticles.length > 0 && (
                                    <div className="text-center py-6 text-muted-foreground text-sm">
                                        <b>You've seen all articles!</b>
                                    </div>
                                )}
                            </div>
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
                            <div 
                                className="p-6 md:p-10 h-full overflow-y-auto"
                            >
                                <ArticleContentView
                                    article={transformedSelectedArticle}
                                    isRecentlyReadMode={isRecentlyReadMode}
                                    isReadLaterMode={isReadLaterMode}
                                    onArticleRemoved={() =>
                                        setSelectedArticleId(null)
                                    }
                                    onMarkAsRead={() => {
                                        console.log('onMarkAsRead callback called:', {
                                            isRecentlyReadMode,
                                            isRead: transformedSelectedArticle.is_read,
                                            articleId: transformedSelectedArticle.id,
                                            shouldUpdate: !isRecentlyReadMode && !transformedSelectedArticle.is_read
                                        })
                                        if (
                                            !isRecentlyReadMode && 
                                            !transformedSelectedArticle.is_read
                                        ) {
                                            console.log('Calling updateArticle.mutate')
                                            updateArticle.mutate({
                                                articleId: transformedSelectedArticle.id,
                                                data: { is_read: true },
                                                articleType: transformedSelectedArticle.article_type,
                                            })
                                        }
                                    }}
                                />
                            </div>
                        ) : null}
                        {!isArticleLoading && !transformedSelectedArticle && (
                            <>
                                {/* Show skeleton on desktop when we have articles (auto-select will happen soon) */}
                                {!isMobile && allArticles.length > 0 ? (
                                    <div className="flex-1 p-8">
                                        <ArticleContentSkeleton />
                                    </div>
                                ) : allArticles.length > 0 ? (
                                    /* Show select message when we have articles but on mobile */
                                    <div className="flex flex-1 items-center justify-center">
                                        <p className="text-muted-foreground">
                                            Select an article to read
                                        </p>
                                    </div>
                                ) : null}
                            </>
                        )}
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
            </div>
            
            {/* Mobile: Stacked layout */}
            <div className="flex md:hidden w-full h-full max-w-screen-sm mx-auto overflow-x-hidden">
                {/* Article List View */}
                <div className={`w-full h-full flex-col max-w-full overflow-x-hidden ${showContent ? 'hidden' : 'flex'}`}>
                    <div className="flex h-14 items-center justify-between border-b px-4 min-w-0">
                        <div className="flex items-center space-x-2 min-w-0 flex-1 max-w-[calc(100vw-6rem)]">
                            <SidebarLeftTrigger className="-ml-1" />
                            <h2 className="font-semibold truncate text-lg max-w-[calc(100vw-10rem)]">
                                {sidebarTitle}
                            </h2>
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
                            {!isRecentlyReadMode && !isReadLaterMode && (
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
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 transition-all duration-200 hover:scale-110 hover:bg-muted/60"
                                onClick={() =>
                                    handleRefreshWithMessage("Refreshing articles...")
                                }
                                title="Refresh"
                            >
                                <RefreshCw className="h-4 w-4 transition-transform duration-200 hover:rotate-180" />
                            </Button>
                        </div>
                    </div>
                    <div 
                        className="flex-1 overflow-auto min-h-0 max-w-full overflow-x-hidden"
                    >
                        <div className="h-full">
                            {isRecentlyReadMode || isReadLaterMode
                                ? filteredArticles.map(
                                    (article: Article, index: number) => (
                                        <ArticleItem
                                            key={article.id}
                                            article={article}
                                            isActive={
                                                article.id === selectedArticleId
                                            }
                                            isLastInGroup={
                                                index === filteredArticles.length - 1
                                            }
                                            onClick={() =>
                                                handleArticleClick(article.id)
                                            }
                                            isRecentlyReadMode={isRecentlyReadMode}
                                            isReadLaterMode={isReadLaterMode}
                                            index={index}
                                        />
                                    )
                                )
                                : Object.entries(groupedArticles).map(
                                    ([groupId, group]) => (
                                        <div key={groupId}>
                                            <div className="px-3 py-2.5 sticky top-0 bg-background/95 backdrop-blur-sm z-10 mt-3 first:mt-1.5 transition-colors duration-200">
                                                <div className="flex items-center gap-2">
                                                    {group.label === "Today" ||
                                                        group.label === "Yesterday" ? (
                                                        <CheckCircle2 className="h-4 w-4 text-muted-foreground transition-colors duration-200" />
                                                    ) : (
                                                        <CalendarIcon className="h-4 w-4 text-muted-foreground transition-colors duration-200" />
                                                    )}
                                                    <span className="text-xs font-medium text-muted-foreground transition-colors duration-200">
                                                        {group.label}
                                                    </span>
                                                </div>
                                            </div>
                                            {group.articles.map(
                                                (article: Article, index: number) => (
                                                    <ArticleItem
                                                        key={article.id}
                                                        article={article}
                                                        isActive={
                                                            article.id === selectedArticleId
                                                        }
                                                        isLastInGroup={
                                                            index === group.articles.length - 1
                                                        }
                                                        onClick={() =>
                                                            handleArticleClick(article.id)
                                                        }
                                                        index={index}
                                                    />
                                                )
                                            )}
                                        </div>
                                    )
                                )}
                            {hasNextPage && (
                                <div ref={mobileSentinelRef} className="flex items-center justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            )}
                            {!hasNextPage && filteredArticles.length > 0 && (
                                <div className="text-center py-6 text-muted-foreground text-sm">
                                    <b>You've seen all articles!</b>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Article Content View */}
                <div className={`w-full h-full flex-col max-w-full overflow-x-hidden ${showContent ? 'flex' : 'hidden'}`}>
                    <div className="flex h-14 items-center justify-between border-b px-4 min-w-0">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 transition-all duration-200 hover:scale-110 hover:bg-muted/60"
                            onClick={() => setShowContent(false)}
                            title="Back to articles"
                        >
                            <ArrowLeft className="h-4 w-4 transition-transform duration-200 hover:-translate-x-1" />
                        </Button>
                    </div>
                    <div className="flex-1 overflow-auto">
                        {isArticleLoading && (
                            <div className="flex-1 p-4">
                                <ArticleContentSkeleton />
                            </div>
                        )}
                        {!isArticleLoading && transformedSelectedArticle ? (
                            <div 
                                className="p-4 h-full overflow-y-auto overflow-x-hidden max-w-full"
                            >
                                <ArticleContentView
                                    article={transformedSelectedArticle}
                                    isRecentlyReadMode={isRecentlyReadMode}
                                    isReadLaterMode={isReadLaterMode}
                                    onArticleRemoved={() => {
                                        setSelectedArticleId(null)
                                        setShowContent(false)
                                    }}
                                    onMarkAsRead={undefined}
                                />
                            </div>
                        ) : !selectedArticleId ? (
                            <div className="flex flex-1 items-center justify-center">
                                <p className="text-muted-foreground">
                                    Select an article to read
                                </p>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
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
    onMarkAsRead,
}: {
    article: Article
    isRecentlyReadMode?: boolean
    isReadLaterMode?: boolean
    onArticleRemoved?: () => void
    onMarkAsRead?: () => void
}) {
    const updateArticle = useUpdateArticle()
    const { resolvedTheme } = useTheme()
    const [optimisticReadLater, setOptimisticReadLater] = useState(
        article.is_read_later
    )
    const contentRef = useRef<HTMLDivElement>(null)
    const [hasMarkedRead, setHasMarkedRead] = useState(article.is_read)
    const [imageError, setImageError] = useState(false)

    // Reset hasMarkedRead when article changes
    useEffect(() => {
        setHasMarkedRead(article.is_read)
    }, [article.id, article.is_read])

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
            articleType: article.article_type,
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
                articleType: article.article_type,
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

    // Only enable scroll-based read marking on desktop
    useEffect(() => {
        if (
            isRecentlyReadMode ||
            isReadLaterMode ||
            !contentRef.current ||
            hasMarkedRead ||
            typeof window !== 'undefined' && window.innerWidth < 768 // Disable on mobile
        )
            return
        const el = contentRef.current
        const handleScroll = () => {
            // Mark as read on ANY scroll, not just bottom
            if (el.scrollTop > 0 && !hasMarkedRead && !article.is_read) {
                console.log('Scroll detected - attempting to mark as read')
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
                                                articleType: article.article_type,
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
                                                articleType: article.article_type,
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

    // Get priority color for clipped articles
    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case "high":
                return "text-red-700 bg-red-100 border-red-300 dark:text-red-400 dark:bg-red-950 dark:border-red-800"
            case "medium":
                return "text-orange-700 bg-orange-100 border-orange-300 dark:text-orange-400 dark:bg-orange-950 dark:border-orange-800"
            case "low":
                return "text-green-700 bg-green-100 border-green-300 dark:text-green-400 dark:bg-green-950 dark:border-green-800"
            case "default":
            case "clipped":
                return "text-blue-700 bg-blue-100 border-blue-300 dark:text-blue-400 dark:bg-blue-950 dark:border-blue-800"
            default:
                return "text-gray-700 bg-gray-100 border-gray-300 dark:text-gray-400 dark:bg-gray-950 dark:border-gray-800"
        }
    }

    return (
        <article className="max-w-4xl mx-auto w-full min-w-0 overflow-x-hidden">
            <div className="mb-3 w-full min-w-0">
                <h1 
                    className="text-xl sm:text-2xl font-semibold leading-tight break-words w-full hyphens-auto max-w-full"
                    style={{ 
                        wordBreak: "break-all", 
                        overflowWrap: "anywhere",
                        wordWrap: "break-word",
                        hyphens: "auto",
                        width: "100%",
                        maxWidth: "100%"
                    }}
                >
                    {article.title}
                </h1>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 text-[10px] gap-2 sm:gap-0">
                <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                        <AvatarImage
                            src={
                                article.feed?.image_url ||
                                (article.article_type === "clipped" && article.link
                                    ? (() => {
                                        try {
                                            const domain = new URL(article.link).hostname
                                            return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
                                        } catch {
                                            return article.image_url || "/placeholders/avatar.png"
                                        }
                                    })()
                                    : article.image_url) ||
                                "/placeholders/avatar.png"
                            }
                        />
                        <AvatarFallback>
                            {article.feed?.title?.substring(0, 2) || "N/A"}
                        </AvatarFallback>
                    </Avatar>
                    <span className="truncate max-w-[min(150px,calc(50vw))] sm:max-w-[200px]" style={{ wordBreak: "break-all", overflowWrap: "anywhere" }}>
                        {article.author ||
                            article.feed?.title ||
                            (article.article_type === "clipped" && article.link 
                                ? (() => {
                                    try {
                                        return new URL(article.link).hostname
                                    } catch {
                                        return "Unknown Source"
                                    }
                                })()
                                : "Unknown Source")}
                    </span>
                    {article.article_type === "clipped" && (
                        <div
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${getPriorityColor(priority || "default")}`}
                        >
                            <Paperclip className="h-2.5 w-2.5" />
                            <span className="capitalize">
                                {priority || "clipped"}
                            </span>
                        </div>
                    )}
                    <span className="text-muted-foreground before:content-['•'] before:ml-1 before:mr-2">
                        {publishedAtDisplay}
                    </span>
                    {article.estimated_read_time_minutes != null && (
                        <span className="text-muted-foreground before:content-['•'] before:ml-1 before:mr-2">
                            {article.estimated_read_time_minutes} min read
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
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
                            className="h-6 w-6 p-0 rounded-full hover:bg-muted transition-all duration-200 hover:scale-110 hover:shadow-sm"
                            onClick={handleMarkAsRead}
                        >
                            <Check className="h-4 w-4 transition-transform duration-200" />
                            <span className="sr-only">Mark as read</span>
                        </Button>
                    ) : (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 rounded-full hover:bg-muted transition-all duration-200 hover:scale-110 hover:shadow-sm"
                            onClick={handleToggleReadLater}
                        >
                            <BookmarkIcon
                                className={`h-4 w-4 transition-all duration-200 ${optimisticReadLater ? "fill-primary text-primary scale-110" : "hover:scale-110"}`}
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
                    <div className="aspect-video w-full sm:w-3/4 mx-auto overflow-hidden rounded-lg bg-primary/5 mb-6">
                        <img
                            src={article.image_url}
                            alt={article.title || "Article image"}
                            className="w-full h-full object-cover"
                            onError={() => setImageError(true)}
                        />
                    </div>
                )}
                {article.content ? (
                    <div
                        ref={contentRef}
                        className="article-content prose prose-sm sm:prose-lg dark:prose-invert max-w-none w-full min-w-0
                          prose-headings:font-semibold prose-h1:text-lg sm:prose-h1:text-xl prose-h2:text-base sm:prose-h2:text-lg
                          prose-p:leading-relaxed prose-a:text-primary prose-a:no-underline prose-a:hover:underline prose-a:break-words
                          prose-img:rounded-md prose-img:mx-auto prose-img:max-w-full prose-img:h-auto prose-img:w-auto
                          prose-pre:bg-muted prose-pre:p-2 sm:prose-pre:p-4 prose-pre:rounded-md prose-pre:text-xs sm:prose-pre:text-sm prose-pre:overflow-x-auto prose-pre:max-w-full
                          prose-code:text-xs sm:prose-code:text-sm prose-code:break-words prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                          prose-table:text-sm prose-table:block prose-table:overflow-x-auto prose-table:whitespace-nowrap
                          break-words overflow-hidden"
                        dangerouslySetInnerHTML={{ __html: article.content }}
                        style={{
                            fontFamily: "var(--font-garamond-serif)",
                            overflowWrap: "break-word",
                            wordWrap: "break-word",
                            fontSize: "clamp(0.9rem, 2.5vw, 1.125rem)",
                            lineHeight: "1.6",
                            width: "100%",
                            maxWidth: "100%",
                        }}
                    />
                ) : (
                    <div>
                        {((article.note && !article.description) || (!article.note && article.description)) ? (
                            <div
                                className="dark:prose-invert max-w-none prose-blockquote:border-l-4 prose-blockquote:border-primary/20 prose-blockquote:pl-4 prose-blockquote:py-1 prose-blockquote:my-2 prose-blockquote:bg-muted/30 prose-blockquote:rounded-r-md"
                                dangerouslySetInnerHTML={{ __html: `<blockquote>${(article.note && !article.description) ? article.note : article.description}</blockquote>` }}
                                style={{
                                    fontFamily: 'var(--font-garamond-serif)'
                                }}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="mx-auto max-w-md">
                                    <p className="text-muted-foreground">
                                        This article doesn't have any content available.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Visit Website button at the bottom */}
            {article.link && (
                <div className="flex justify-center mt-8 pt-6 border-t">
                    <Button
                        variant="outline"
                        size="lg"
                        onClick={() => window.open(article.link, '_blank', 'noopener,noreferrer')}
                        className="inline-flex items-center gap-2 transition-all duration-200 hover:scale-105 hover:shadow-md hover:bg-muted/20"
                    >
                        <Globe className="h-4 w-4 transition-transform duration-200 hover:rotate-12" />
                        Visit Website
                    </Button>
                </div>
            )}
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
    index = 0,
}: {
    article: Article
    isActive?: boolean
    isLastInGroup?: boolean
    onClick: () => void
    isRecentlyReadMode?: boolean
    isReadLaterMode?: boolean
    index?: number
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
            case "default":
            case "clipped":
                return "text-blue-700 bg-blue-100 border-blue-300 dark:text-blue-400 dark:bg-blue-950 dark:border-blue-800"
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
            className={`mx-0 py-2.5 px-3 ${!isLastInGroup ? "border-b border-border" : ""} 
            ${!isActive ? "hover:bg-muted/60 hover:border-l-primary/20 hover:shadow-sm" : ""}
            active:bg-secondary/10
            transition-all duration-200 ease-out cursor-pointer 
            ${isActive ? "bg-secondary/5 border-l-2 border-l-secondary shadow-sm" : "border-l-2 border-l-transparent"}
            ${article.is_read ? "opacity-70" : ""}`}
            onClick={onClick}
        >
            <div className={`flex gap-3 w-full min-w-0 max-w-full overflow-hidden ${!article.image_url || articleImageError ? 'pr-0' : ''}`}>
                <div className={`flex-1 space-y-1.5 min-w-0 overflow-hidden ${!article.image_url || articleImageError ? 'max-w-full' : 'max-w-[calc(100vw-5rem)]'}`}>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                            {article.article_type === "clipped" && (
                                <div
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${getPriorityColor(priority || "default")}`}
                                >
                                    <Paperclip className="h-2.5 w-2.5" />
                                    <span className="capitalize">
                                        {priority || "clipped"}
                                    </span>
                                </div>
                            )}
                            {(article.feed?.image_url || (article.article_type === "clipped" && article.link)) && !feedImageError ? (
                                <img
                                    src={article.feed?.image_url || (() => {
                                        try {
                                            const domain = new URL(article.link).hostname
                                            return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`
                                        } catch {
                                            return "/placeholders/avatar.png"
                                        }
                                    })()}
                                    alt=""
                                    className="h-3 w-3 shrink-0 rounded"
                                    onError={() => setFeedImageError(true)}
                                />
                            ) : (
                                <div className="h-3 w-3 shrink-0 rounded bg-primary/8" />
                            )}
                            <span className="text-[10px] text-muted-foreground truncate max-w-[min(120px,calc(100vw-12rem))]" style={{ wordBreak: "break-all", overflowWrap: "anywhere" }}>
                                {article.article_type === "clipped" && article.link 
                                    ? (() => {
                                        try {
                                            return new URL(article.link).hostname
                                        } catch {
                                            return "Unknown Source"
                                        }
                                    })()
                                    : article.feed?.title || "Unknown Source"}
                            </span>
                        </div>
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground whitespace-nowrap">
                            <Clock className="h-3 w-3" />
                            {timeDisplay}
                        </span>
                    </div>
                    <h3
                        className={`text-sm leading-tight line-clamp-2 break-words overflow-hidden max-w-full ${article.is_read ? "font-normal" : "font-medium"}`}
                        style={{
                            wordBreak: "break-all",
                            overflowWrap: "anywhere",
                            hyphens: "auto",
                            width: "100%",
                            maxWidth: "100%"
                        }}
                    >
                        {article.title}
                    </h3>
                    {article.author && (
                        <div className="text-[10px] text-muted-foreground truncate max-w-[calc(100vw-7rem)]" style={{ wordBreak: "break-all", overflowWrap: "anywhere" }}>
                            {article.author}
                        </div>
                    )}
                    {((article.note && !article.description) || (!article.note && article.description)) && (
                        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-snug break-words overflow-hidden w-full" style={{ wordBreak: "break-all", overflowWrap: "anywhere" }}>
                            {(article.note && !article.description) ? article.note : stripHTML(article.description || "")}
                        </p>
                    )}
                </div>
                {article.image_url && !articleImageError && (
                    <div className="h-16 w-16 md:h-16 md:w-16 flex-shrink-0 overflow-hidden rounded-md bg-secondary/5 transition-all duration-200 ease-out flex items-center justify-center hover:shadow-md hover:brightness-105">
                        <img
                            src={article.image_url}
                            alt={article.title || "Article image"}
                            className="h-full w-full object-cover transition-all duration-200 ease-out"
                            onError={() => setArticleImageError(true)}
                        />
                    </div>
                )}
            </div>
        </div>
    )
}
