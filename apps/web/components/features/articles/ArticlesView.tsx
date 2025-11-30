"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "react-hot-toast"

import { ArticlesEmptyState } from "./ArticlesEmptyState"
import { ArticlesErrorState } from "./ArticlesErrorState"
import { ArticlesViewSkeleton } from "./ArticlesViewSkeleton"
import { FeedSubscriptionModal } from "@/components/features/feeds/FeedSubscriptionModal"
import { Button } from "@/components/ui/button"
import { ArticlesLayout } from "./ArticlesLayout"
import { ArticlesSidebar } from "./ArticlesSidebar"
import { ArticlesDetail } from "./ArticlesDetail"
import { useArticlesStore } from "./stores/use-articles-store"
import { useArticlesData } from "./hooks/use-articles-data"
import { useDeepRefresh } from "./hooks/use-deep-refresh"
import { useIsMobile } from "@/hooks/use-mobile"

import { useFeed, useUpdateArticle, ArticleFilterMode } from "@readspace/shared"

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
    mode?: ArticleFilterMode
    /** Callback for creating new folder */
    onCreateFolder?: () => void
    /** Default layout for the panels */
    defaultLayout?: number[]
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
    mode = ArticleFilterMode.AllArticles,
    defaultLayout = [35, 65],
}: ArticlesViewProps) {
    // Store State
    const {
        viewMode,
        selectedArticleId,
        showUnreadOnly,
        setViewMode,
        selectArticle,
        toggleUnreadFilter,
    } = useArticlesStore()

    // Local State
    const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] =
        useState(false)
    const isMobile = useIsMobile()

    // Panel State
    const [panelLayout, setPanelLayout] = useState<number[]>(defaultLayout)

    // Persist panel layout to cookie
    const onLayoutChange = (sizes: number[]) => {
        setPanelLayout(sizes)
        document.cookie = `react-resizable-panels:layout=${JSON.stringify(sizes)}; path=/; max-age=31536000; SameSite=Lax`
    }

    // Reset store when view context changes
    useEffect(() => {
        // We only want to reset selection/view mode when the "context" (feed/folder/mode) changes
        selectArticle(null)
        setViewMode("list")
    }, [feedId, folderId, mode, selectArticle, setViewMode])

    // Data Hooks
    const { query: articlesQuery, articles: allArticles } = useArticlesData({
        mode,
        feedId,
        folderId,
        publishedSince,
        publishedUntil,
    })

    const {
        data: feedData,
        error: feedError,
        isLoading: isFeedLoading,
    } = useFeed(feedId || "", {
        enabled: !!feedId,
    })

    // Mutations
    const updateArticle = useUpdateArticle()
    const { handleDeepRefresh, isRefreshing: isDeepRefreshing } =
        useDeepRefresh()

    // Derived State
    const isRecentlyReadMode = mode === ArticleFilterMode.RecentlyRead
    const isReadLaterMode = mode === ArticleFilterMode.ReadLater

    const filteredArticles = useMemo(() => {
        if (showUnreadOnly && !isReadLaterMode) {
            return allArticles.filter((a) => !a.is_read)
        }
        return allArticles
    }, [allArticles, showUnreadOnly, isReadLaterMode])

    const selectedArticle = useMemo(
        () => allArticles.find((a) => a.id === selectedArticleId),
        [allArticles, selectedArticleId]
    )

    const shouldShowPreviewBanner = !!(
        feedId &&
        feedData &&
        feedData.is_subscribed === false
    )

    // Handlers
    const handleBackToList = () => {
        if (isMobile) {
            setViewMode("list")
        }
    }

    const handleRefreshWithMessage = async (message: string) => {
        toast.loading(message, { id: "refresh" })
        try {
            await articlesQuery.refetch()
            toast.success("Articles refreshed!", { id: "refresh" })
        } catch (error) {
            console.error("Refresh failed:", error)
            toast.error("Failed to refresh articles.", { id: "refresh" })
        }
    }

    const onDeepRefresh = async () => {
        await handleDeepRefresh(feedId, async () => {
            await articlesQuery.refetch()
        })
    }

    const handleMarkAsRead = () => {
        if (!selectedArticle) return
        updateArticle.mutate({
            articleId: selectedArticle.id,
            data: { is_read: true },
        })
    }

    // Auto-select first article on desktop
    useEffect(() => {
        if (isMobile) return

        if (
            allArticles.length > 0 &&
            !selectedArticleId &&
            !articlesQuery.isLoading &&
            !articlesQuery.isFetching
        ) {
            // Sort articles by published date (newest first)
            const sortedArticles = [...allArticles].sort((a, b) => {
                if (!a.published_at) return 1
                if (!b.published_at) return -1
                return (
                    new Date(b.published_at).getTime() -
                    new Date(a.published_at).getTime()
                )
            })

            // Select first article (or first unread if filter is on)
            const firstArticle = showUnreadOnly
                ? sortedArticles.find((a) => !a.is_read) || sortedArticles[0]
                : sortedArticles[0]

            if (firstArticle?.id) {
                selectArticle(firstArticle.id)
            }
        }
    }, [
        allArticles,
        selectedArticleId,
        isMobile,
        showUnreadOnly,
        articlesQuery.isLoading,
        articlesQuery.isFetching,
        selectArticle,
    ])

    // Render Logic
    const isInitialLoading = articlesQuery.isLoading && allArticles.length === 0

    if (isInitialLoading) {
        return <ArticlesViewSkeleton showUnreadBadge={false} layout={panelLayout} />
    }

    if (feedId && feedError && !isFeedLoading) {
        return (
            <div className="flex h-[calc(100vh-1rem)] w-full bg-background rounded-xl shadow-sm">
                <ArticlesErrorState
                    error={feedError}
                    onRetry={() => handleRefreshWithMessage("Retrying...")}
                />
            </div>
        )
    }

    if (
        !articlesQuery.isLoading &&
        !articlesQuery.isFetching &&
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
                    previewRefreshFailed={false}
                    onRefresh={() =>
                        handleRefreshWithMessage("Refreshing articles...")
                    }
                />
            </div>
        )
    }

    if (filteredArticles.length === 0 && allArticles.length > 0) {
        return (
            <div className="flex h-full md:h-[calc(100vh-1rem)] w-full bg-background md:rounded-xl md:shadow-sm">
                <div className="w-full flex flex-col items-center justify-center gap-4">
                    <p className="text-muted-foreground">
                        No unread articles found matching your filters.
                    </p>
                    <Button variant="outline" onClick={toggleUnreadFilter}>
                        Show All Articles
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-[100dvh] md:h-[calc(100vh-1rem)] w-full bg-background md:rounded-xl md:shadow-sm">
            <ArticlesLayout
                isMobile={!!isMobile}
                showContent={viewMode === "content"}
                defaultLayout={panelLayout}
                onLayoutChange={onLayoutChange}
                sidebar={
                    <ArticlesSidebar
                        feedId={feedId}
                        folderId={folderId}
                        mode={mode}
                        initialSidebarTitle={initialSidebarTitle}
                        articles={filteredArticles}
                        isLoading={articlesQuery.isLoading}
                        isFetchingNextPage={articlesQuery.isFetchingNextPage}
                        hasNextPage={articlesQuery.hasNextPage}
                        feedData={feedData}
                        fetchNextPage={articlesQuery.fetchNextPage}
                        handleDeepRefresh={onDeepRefresh}
                        isDeepRefreshing={isDeepRefreshing}
                        setIsSubscriptionModalOpen={setIsSubscriptionModalOpen}
                    />
                }
                detail={
                    <ArticlesDetail
                        article={selectedArticle}
                        isRecentlyReadMode={isRecentlyReadMode}
                        isReadLaterMode={isReadLaterMode}
                        shouldShowPreviewBanner={shouldShowPreviewBanner}
                        onMarkAsRead={handleMarkAsRead}
                        onBack={handleBackToList}
                        feedId={feedId}
                    />
                }
            />

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
