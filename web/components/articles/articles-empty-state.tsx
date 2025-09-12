"use client"

import { Button } from "@/components/ui/button"
import { useFeeds, useFolders } from "@/lib/api/hooks/feeds"
import { useModalStore } from "@/lib/stores/modal-store"
import { BookOpen, FolderPlus, RefreshCw, Rss } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

interface ArticlesEmptyStateProps {
    mode?: "allArticles" | "recentlyRead" | "readLater" | "today"
    feedId?: string
    folderId?: string
    onRefresh?: () => void
    onCreateFolder?: () => void
    onAddFeed?: (folderId?: string) => void
}

export function ArticlesEmptyState({
    mode = "allArticles",
    feedId,
    folderId,
    onRefresh,
    onCreateFolder,
    onAddFeed,
}: ArticlesEmptyStateProps) {
    const router = useRouter()
    const [isRefreshing, setIsRefreshing] = useState(false)
    const { openFolderModal } = useModalStore()

    // Get user's current feed/folder state
    const { data: folders, isLoading: isFoldersLoading } = useFolders({
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        staleTime: 5 * 60 * 1000,
    })
    const { data: feeds, isLoading: isFeedsLoading } = useFeeds(
        {},
        {
            refetchOnMount: false,
            refetchOnWindowFocus: false,
            staleTime: 5 * 60 * 1000,
        }
    )

    const typedFolders = (folders as Array<{ id: string; name: string }>) || []
    const typedFeeds = (feeds as Array<{ id: string; title: string }>) || []

    const hasNoFolders = typedFolders.length === 0
    const hasNoFeeds = typedFeeds.length === 0
    const isLoading = isFoldersLoading || isFeedsLoading

    const handleRefresh = async () => {
        if (onRefresh) {
            setIsRefreshing(true)
            try {
                await onRefresh()
            } finally {
                setIsRefreshing(false)
            }
        }
    }

    // Special messaging for different modes
    const getModeSpecificContent = () => {
        switch (mode) {
            case "recentlyRead":
                return {
                    title: "No recently read articles",
                    subtitle: "Articles you read will appear here for easy reference",
                    icon: BookOpen,
                    action: (
                        <Button
                            variant="outline"
                            onClick={() => router.push("/articles")}
                            className="transition-all duration-200 hover:scale-105 hover:shadow-md"
                        >
                            <BookOpen className="mr-2 h-4 w-4" />
                            Browse Articles
                        </Button>
                    ),
                }
            case "readLater":
                return {
                    title: "No articles saved for later",
                    subtitle: "Save interesting articles to read when you have more time",
                    icon: BookOpen,
                    action: (
                        <Button
                            variant="outline"
                            onClick={() => router.push("/articles")}
                            className="transition-all duration-200 hover:scale-105 hover:shadow-md"
                        >
                            <BookOpen className="mr-2 h-4 w-4" />
                            Browse Articles
                        </Button>
                    ),
                }
            case "today":
                return {
                    title: "No articles published today",
                    subtitle: "Check back later as new content arrives throughout the day",
                    icon: RefreshCw,
                    action: onRefresh && (
                        <Button
                            variant="outline"
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="transition-all duration-200 hover:scale-105 hover:shadow-md disabled:hover:scale-100"
                        >
                            <RefreshCw
                                className={`mr-2 h-4 w-4 transition-transform ${isRefreshing ? "animate-spin" : "hover:rotate-180"}`}
                            />
                            {isRefreshing ? "Refreshing..." : "Check for Updates"}
                        </Button>
                    ),
                }
            default:
                return null
        }
    }

    const modeContent = getModeSpecificContent()
    // Show mode-specific content for readLater and recentlyRead even if no feeds/folders
    // Show mode-specific content for other modes only if user has feeds (not just folders)
    if (modeContent && !isLoading && (mode === "readLater" || mode === "recentlyRead" || !hasNoFeeds)) {
        return (
            <div className="flex h-full w-full items-center justify-center p-6">
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
                <div className="text-center space-y-4">
                    <RefreshCw className="mx-auto h-12 w-12 text-muted-foreground animate-spin" />
                    <p className="text-muted-foreground">Loading feeds...</p>
                </div>
            </div>
        )
    }

    if (hasNoFolders && hasNoFeeds) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 w-full max-w-2xl mx-auto px-4">
                    <div
                        className="w-full sm:w-48 border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center space-y-3 hover:border-muted-foreground/50 transition-colors cursor-pointer"
                        onClick={openFolderModal}
                    >
                        <FolderPlus className="mx-auto h-8 w-8 text-muted-foreground" />
                        <div className="space-y-1">
                            <h4 className="text-sm font-medium text-foreground">
                                Create folder
                            </h4>
                            <p className="text-xs text-muted-foreground">
                                Organize your feeds
                            </p>
                        </div>
                    </div>

                    <div className="text-muted-foreground/60 text-sm shrink-0">
                        or
                    </div>

                    <div
                        className="w-full sm:w-48 border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center space-y-3 hover:border-muted-foreground/50 transition-colors cursor-pointer"
                        onClick={() => router.push("/discover")}
                    >
                        <Rss className="mx-auto h-8 w-8 text-muted-foreground" />
                        <div className="space-y-1">
                            <h4 className="text-sm font-medium text-foreground">
                                Follow some feeds
                            </h4>
                            <p className="text-xs text-muted-foreground">
                                Discover feeds you'll love
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (!hasNoFolders && hasNoFeeds) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <div className="w-full max-w-md mx-auto px-4">
                    <div
                        className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center space-y-4 hover:border-muted-foreground/50 transition-colors cursor-pointer"
                        onClick={() => router.push("/discover")}
                    >
                        <Rss className="mx-auto h-12 w-12 text-muted-foreground" />
                        <div className="space-y-2">
                            <h3 className="text-lg font-medium text-foreground">
                                Add your first feed
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                Discover feeds to get started with fresh content
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-full w-full items-center justify-center p-6">
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
                {onRefresh && (
                    <Button
                        variant="outline"
                        onClick={handleRefresh}
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
