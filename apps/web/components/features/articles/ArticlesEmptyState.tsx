"use client"

import { Button } from "@/components/ui/button"
import { SidebarLeftTrigger } from "@/components/ui/sidebar"
import { useIsMobile } from "@/hooks/use-mobile"
import { useFeeds, ArticleFilterMode } from "@readspace/shared"
import { AlertTriangle, BookOpen, RefreshCw, Rss, Upload } from "lucide-react"
import { useDeepRefresh } from "./hooks/use-deep-refresh"
import Link from "next/link"
import { useMemo } from "react"

function GetStartedCards() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-lg mx-auto">
            <Link
                href="/discover"
                className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 text-center space-y-3 hover:border-muted-foreground/50 transition-colors cursor-pointer"
            >
                <Rss className="mx-auto h-8 w-8 text-muted-foreground" />
                <div className="space-y-1">
                    <h4 className="text-sm font-medium text-foreground">
                        Follow some feeds
                    </h4>
                    <p className="text-xs text-muted-foreground">
                        Discover feeds you&apos;ll love
                    </p>
                </div>
            </Link>

            <Link
                href="/import-opml"
                className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 text-center space-y-3 hover:border-muted-foreground/50 transition-colors cursor-pointer"
            >
                <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                <div className="space-y-1">
                    <h4 className="text-sm font-medium text-foreground">
                        Import OPML file
                    </h4>
                    <p className="text-xs text-muted-foreground">
                        Migrating from another reader?
                    </p>
                </div>
            </Link>
        </div>
    )
}

type ArticlesEmptyStateProps = {
    mode?: ArticleFilterMode
    feedId?: string
    folderId?: string
    isPreviewMode?: boolean
    previewRefreshFailed?: boolean
    onRefresh?: () => void
}

export function ArticlesEmptyState({
    mode = ArticleFilterMode.AllArticles,
    feedId,
    folderId,
    isPreviewMode = false,
    previewRefreshFailed = false,
    onRefresh,
}: ArticlesEmptyStateProps) {
    const isMobile = useIsMobile()

    // Get user's current feed/folder state
    const { data: feedsResponse, isLoading: isFeedsLoading } = useFeeds(
        {},
        {
            refetchOnMount: false,
            refetchOnWindowFocus: false,
            staleTime: 5 * 60 * 1000,
        }
    )
    const feeds = feedsResponse?.subscriptions || []

    const typedFolders = useMemo(() => {
        return feedsResponse?.folders || []
    }, [feedsResponse])

    const subscribedFeeds = (feeds || []).map((sub) => ({
        id: sub.feed.id,
        title: sub.custom_title || sub.feed.title,
    }))

    const hasNoFolders = typedFolders.length === 0
    const hasNoFeeds = subscribedFeeds.length === 0
    const isLoading = isFeedsLoading

    // Deep refresh: poll external RSS feed (only for individual feeds)
    const { isRefreshing, handleDeepRefresh: performDeepRefresh } =
        useDeepRefresh()

    const handleDeepRefresh = async () => {
        await performDeepRefresh(feedId, onRefresh)
    }

    // Special messaging for different modes
    const getModeSpecificContent = () => {
        switch (mode) {
            case ArticleFilterMode.RecentlyRead:
                return {
                    title: "No recently read articles",
                    subtitle:
                        "Articles you read will appear here for easy reference",
                    icon: BookOpen,
                    action: (
                        <Button
                            asChild
                            variant="outline"
                            className="transition-all duration-200 hover:scale-105 hover:shadow-md"
                        >
                            <Link href="/today">
                                <BookOpen className="mr-2 h-4 w-4" />
                                Browse Articles
                            </Link>
                        </Button>
                    ),
                }
            case ArticleFilterMode.ReadLater:
                return {
                    title: "No articles saved for later",
                    subtitle:
                        "Save interesting articles to read when you have more time",
                    icon: BookOpen,
                    action: (
                        <Button
                            asChild
                            variant="outline"
                            className="transition-all duration-200 hover:scale-105 hover:shadow-md"
                        >
                            <Link href="/today">
                                <BookOpen className="mr-2 h-4 w-4" />
                                Browse Articles
                            </Link>
                        </Button>
                    ),
                }
            case ArticleFilterMode.Today:
                return {
                    title: "No articles published today",
                    subtitle:
                        "Check back later as new content arrives throughout the day",
                    icon: RefreshCw,
                    action: undefined,
                }
            default:
                return null
        }
    }

    const modeContent = getModeSpecificContent()
    // Show mode-specific content for readLater and recentlyRead even if no feeds/folders
    // Show mode-specific content for other modes only if user has feeds (not just folders)
    if (
        modeContent &&
        !isLoading &&
        (mode === ArticleFilterMode.ReadLater ||
            mode === ArticleFilterMode.RecentlyRead ||
            !hasNoFeeds)
    ) {
        return (
            <div className="flex h-full w-full items-center justify-center p-6">
                {isMobile && (
                    <div className="absolute top-4 left-4">
                        <SidebarLeftTrigger />
                    </div>
                )}
                <div className="text-center space-y-6 max-w-sm mx-auto">
                    <div>
                        <modeContent.icon className="mx-auto h-12 w-12 text-muted-foreground" />
                    </div>
                    <div className="space-y-3">
                        <h3 className="text-lg font-semibold text-foreground tracking-tight">
                            {modeContent.title}
                        </h3>
                        <p className="text-sm text-muted-foreground/80 dark:text-muted-foreground leading-relaxed">
                            {modeContent.subtitle}
                        </p>
                    </div>
                    {modeContent.action}
                </div>
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                {isMobile && (
                    <div className="absolute top-4 left-4">
                        <SidebarLeftTrigger />
                    </div>
                )}
            </div>
        )
    }

    if (hasNoFolders && hasNoFeeds) {
        return (
            <div className="flex h-full w-full items-center justify-center p-6">
                {isMobile && (
                    <div className="absolute top-4 left-4">
                        <SidebarLeftTrigger />
                    </div>
                )}
                <GetStartedCards />
            </div>
        )
    }

    if (!hasNoFolders && hasNoFeeds) {
        return (
            <div className="flex h-full w-full items-center justify-center p-6">
                {isMobile && (
                    <div className="absolute top-4 left-4">
                        <SidebarLeftTrigger />
                    </div>
                )}
                <GetStartedCards />
            </div>
        )
    }

    // Special handling for preview mode feed refresh failure
    if (feedId && isPreviewMode && previewRefreshFailed) {
        return (
            <div className="flex h-full w-full items-center justify-center p-6">
                {isMobile && (
                    <div className="absolute top-4 left-4">
                        <SidebarLeftTrigger />
                    </div>
                )}
                <div className="text-center space-y-6 max-w-sm mx-auto">
                    <div>
                        <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500" />
                    </div>
                    <div className="space-y-3">
                        <h3 className="text-lg font-semibold text-foreground tracking-tight">
                            Whoops! This feed might be broken
                        </h3>
                        <p className="text-sm text-muted-foreground/80 dark:text-muted-foreground leading-relaxed">
                            We couldn&apos;t fetch articles from this feed. It
                            may be temporarily unavailable or the feed URL might
                            be incorrect.
                        </p>
                    </div>
                    {onRefresh && (
                        <Button
                            variant="outline"
                            onClick={handleDeepRefresh}
                            disabled={isRefreshing}
                            className="transition-all duration-200 hover:scale-105 hover:shadow-md disabled:hover:scale-100"
                        >
                            <RefreshCw
                                className={`mr-2 h-4 w-4 transition-transform ${isRefreshing ? "animate-spin" : "hover:rotate-180"}`}
                            />
                            {isRefreshing ? "Refreshing..." : "Try Again"}
                        </Button>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-full w-full items-center justify-center p-6">
            {isMobile && (
                <div className="absolute top-4 left-4">
                    <SidebarLeftTrigger />
                </div>
            )}
            <div className="text-center space-y-6 max-w-sm mx-auto">
                <div>
                    <BookOpen className="mx-auto h-12 w-12 text-muted-foreground" />
                </div>
                <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-foreground tracking-tight">
                        {feedId
                            ? "No articles in this feed"
                            : folderId
                              ? "No articles in this folder"
                              : "No articles found"}
                    </h3>
                    <p className="text-sm text-muted-foreground/80 dark:text-muted-foreground leading-relaxed">
                        {feedId
                            ? "This feed hasn't published any articles yet, or they may not have loaded"
                            : folderId
                              ? "No feeds in this folder have published articles yet"
                              : "Try refreshing or check back later for new content"}
                    </p>
                </div>
                {onRefresh && feedId && (
                    <Button
                        variant="outline"
                        onClick={handleDeepRefresh}
                        disabled={isRefreshing}
                        className="transition-all duration-200 hover:scale-105 hover:shadow-md disabled:hover:scale-100"
                    >
                        <RefreshCw
                            className={`mr-2 h-4 w-4 transition-transform ${isRefreshing ? "animate-spin" : "hover:rotate-180"}`}
                        />
                        {isRefreshing ? "Refreshing..." : "Check for Updates"}
                    </Button>
                )}
            </div>
        </div>
    )
}
