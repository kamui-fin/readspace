"use client"

import { Button } from "@/components/ui/button"
import { SidebarLeftTrigger } from "@/components/ui/sidebar"
import { useIsMobile } from "@/hooks/useMobile"
import { useFeeds, useFolders, useRefreshFeed } from "@readspace/shared"
import { BookOpen, RefreshCw, Rss } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

interface ArticlesEmptyStateProps {
    mode?: "allArticles" | "recentlyRead" | "readLater" | "today"
    feedId?: string
    folderId?: string
    onRefresh?: () => void
}

export function ArticlesEmptyState({
    mode = "allArticles",
    feedId,
    folderId,
    onRefresh,
}: ArticlesEmptyStateProps) {
    const router = useRouter()
    const [isRefreshing, setIsRefreshing] = useState(false)
    const isMobile = useIsMobile()
    const refreshFeed = useRefreshFeed()

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

    // Deep refresh: poll external RSS feed (only for individual feeds)
    const handleDeepRefresh = async () => {
        if (!feedId) return

        setIsRefreshing(true)
        toast.loading("Checking for new articles...", { id: "deep-refresh" })

        try {
            await refreshFeed.mutateAsync({
                feedId: feedId,
                forceRefetch: true,
            })
            // After deep refresh completes, refetch articles
            if (onRefresh) {
                onRefresh()
            }
            toast.success("Check complete! Articles updated.", {
                id: "deep-refresh",
            })
        } catch (error) {
            console.error("Deep refresh failed:", error)
            toast.error("Failed to check for new articles. Please try again.", {
                id: "deep-refresh",
            })
        } finally {
            setIsRefreshing(false)
        }
    }

    // Special messaging for different modes
    const getModeSpecificContent = () => {
        switch (mode) {
            case "recentlyRead":
                return {
                    title: "No recently read articles",
                    subtitle:
                        "Articles you read will appear here for easy reference",
                    icon: BookOpen,
                    action: (
                        <Button
                            variant="outline"
                            onClick={() => router.push("/today")}
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
                    subtitle:
                        "Save interesting articles to read when you have more time",
                    icon: BookOpen,
                    action: (
                        <Button
                            variant="outline"
                            onClick={() => router.push("/today")}
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
        (mode === "readLater" || mode === "recentlyRead" || !hasNoFeeds)
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
                <div className="w-full max-w-sm mx-auto">
                    <div
                        className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center space-y-3 hover:border-muted-foreground/50 transition-colors cursor-pointer"
                        onClick={() => router.push("/discover")}
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
                    </div>
                </div>
            </div>
        )
    }

    if (!hasNoFolders && hasNoFeeds) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                {isMobile && (
                    <div className="absolute top-4 left-4">
                        <SidebarLeftTrigger />
                    </div>
                )}
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
                            ? "This feed hasn&apos;t published any articles yet, or they may not have loaded"
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
