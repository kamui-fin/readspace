"use client"

import { FeedPreviewBanner } from "@/components/feeds/FeedPreviewBanner"
import { FeedSubscriptionModal } from "@/components/FeedSubscriptionModal"
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
import { useIsMobile } from "@/hooks/useMobile"
import { useClearPendingNavigation } from "@/hooks/useNavigationState"
import type { Article, Feed } from "@readspace/shared"
import {
    useArticle,
    useFeed,
    useFeeds,
    useUpdateArticle,
} from "@readspace/shared"
import {
    CheckCircle2,
    Eye,
    EyeOff,
    MoreVertical,
    RefreshCw,
} from "lucide-react"
import { useEffect, useState } from "react"
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
    const { clearPending } = useClearPendingNavigation()

    // Data queries
    const { data: allUserFeeds } = useFeeds(
        {},
        {
            refetchOnMount: false,
            refetchOnWindowFocus: false,
            staleTime: 5 * 60 * 1000,
        }
    )

    // Fetch feed data when viewing a specific feed to check subscription status
    const { data: feedData } = useFeed(feedId || "")

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

    /**
     * Handle article selection
     */
    const handleArticleSelect = (articleId: string) => {
        setSelectedArticleId(articleId)
        if (isMobile) {
            setShowContent(true)
        }
    }

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
        _summary: string | null,
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
    }, [feedId, folderId, mode, publishedSince, publishedUntil])

    return (
        <div className="flex h-full flex-col">
            {/* Preview banner for unsubscribed feeds */}
            {shouldShowPreviewBanner && (
                <FeedPreviewBanner
                    feedTitle={feedData?.title}
                    feedDescription={feedData?.description}
                    onFollow={() => setIsSubscriptionModalOpen(true)}
                />
            )}

            {/* Toolbar */}
            <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-2">
                    <SidebarLeftTrigger />
                    <h1 className="text-lg font-semibold">{sidebarTitle}</h1>
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
                                    onClick={() =>
                                        setShowUnreadOnly(!showUnreadOnly)
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

                    {/* Refresh dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={isDeepRefreshing}
                            >
                                <RefreshCw
                                    className={`h-4 w-4 ${isDeepRefreshing ? "animate-spin" : ""}`}
                                />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem
                                onClick={() => handleRefresh(false)}
                            >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Quick Refresh
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => handleRefresh(true)}
                            >
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Deep Refresh
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* More actions */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
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
                </div>
            </div>

            {/* Main content area */}
            <div className="flex-1 overflow-hidden">
                {isMobile ? (
                    // Mobile: Single panel with navigation
                    <div className="h-full">
                        {showContent && selectedArticle ? (
                            <div className="flex h-full flex-col">
                                <div className="flex items-center border-b px-4 py-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleBackToList}
                                    >
                                        ← Back
                                    </Button>
                                </div>
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
                            </div>
                        ) : (
                            <ArticlesList
                                articles={allArticles}
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
                        )}
                    </div>
                ) : (
                    // Desktop: Resizable panels
                    <ResizablePanelGroup
                        direction="horizontal"
                        className="h-full"
                    >
                        <ResizablePanel
                            defaultSize={35}
                            minSize={25}
                            maxSize={50}
                        >
                            <ArticlesList
                                articles={allArticles}
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
                        </ResizablePanel>

                        <ResizableHandle withHandle />

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
                )}
            </div>

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
