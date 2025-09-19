import { useEffect, useState } from "react"
import { toast } from "react-hot-toast"
import { useRefreshFeed, useRefreshFolderFeeds, useRefreshAllFeeds, useRefreshStatus } from "@readspace/shared"

// Define types for refresh responses
interface RefreshResponse {
    task_id?: string
    message?: string
}

interface RefreshStatusResponse {
    status: "pending" | "in_progress" | "completed" | "failed"
    task_id?: string
    progress?: {
        completed: number
        total: number
        successful: number
        failed: number
    }
    result?: {
        refreshed_count: number
        failed_count: number
        error_summary?: Record<string, number>
    }
}

interface UseArticlesRefreshParams {
    /** Function to refetch articles after refresh */
    onRefreshComplete: () => void
}

interface UseArticlesRefreshResult {
    /** Current refresh task ID */
    refreshTaskId: string | null
    /** Type of refresh being performed */
    refreshType: "folder" | "all" | null
    /** Whether deep refresh is in progress */
    isDeepRefreshing: boolean
    /** Function to start refresh */
    startRefresh: (
        feedIds?: string[],
        type?: "folder" | "all",
        isDeep?: boolean
    ) => void
    /** Function to stop/cancel refresh */
    stopRefresh: () => void
}

/**
 * Custom hook to handle article refresh functionality with progress tracking
 */
export function useArticlesRefresh({
    onRefreshComplete,
}: UseArticlesRefreshParams): UseArticlesRefreshResult {
    const [refreshTaskId, setRefreshTaskId] = useState<string | null>(null)
    const [refreshType, setRefreshType] = useState<"folder" | "all" | null>(
        null
    )
    const [isDeepRefreshing, setIsDeepRefreshing] = useState(false)

    const refreshFeed = useRefreshFeed()
    const refreshFolderFeeds = useRefreshFolderFeeds()
    const refreshAllFeeds = useRefreshAllFeeds()
    const { data: refreshStatus } = useRefreshStatus(
        refreshTaskId,
        !!refreshTaskId
    )

    /**
     * Start a refresh operation
     */
    const startRefresh = (
        feedIds?: string[],
        type: "folder" | "all" = "all",
        isDeep = false
    ) => {
        setIsDeepRefreshing(isDeep)
        setRefreshType(type)

        const refreshLabel = type === "folder" ? "folder feeds" : "feeds"

        if (!isDeep) {
            // For simple refresh, just refetch articles without API calls
            toast.success("Articles refreshed!", { id: "bulk-refresh" })
            onRefreshComplete()
            setRefreshType(null)
            setIsDeepRefreshing(false)
            return
        }

        // For deep refresh operations
        toast.loading(
            `Starting deep refresh of ${refreshLabel}. This will force re-fetch all articles and may take longer.`,
            { id: "bulk-refresh" }
        )

        if (feedIds && feedIds.length === 1) {
            // Single feed refresh
            refreshFeed.mutate(
                {
                    feedId: feedIds[0] ?? "",
                    forceRefetch: true,
                },
                {
                    onSuccess: () => {
                        toast.success("Feed refresh completed!", {
                            id: "bulk-refresh",
                        })
                        onRefreshComplete()
                        setRefreshType(null)
                        setIsDeepRefreshing(false)
                    },
                    onError: (error) => {
                        console.error("Refresh failed:", error)
                        toast.error(
                            "Failed to start refresh. Please try again.",
                            {
                                id: "bulk-refresh",
                            }
                        )
                        setRefreshType(null)
                        setIsDeepRefreshing(false)
                    },
                }
            )
        } else if (type === "folder" && feedIds && feedIds.length > 1) {
            // Folder refresh - need to get folder ID from context
            // For now, use the refreshAllFeeds as fallback
            refreshAllFeeds.mutate(undefined, {
                onSuccess: (data: any) => {
                    // Extract task ID if available for progress tracking
                    if (data && typeof data === 'object' && 'task_id' in data) {
                        setRefreshTaskId(data.task_id as string)
                    } else {
                        toast.success("Refresh started successfully!", {
                            id: "bulk-refresh",
                        })
                        setRefreshType(null)
                        setIsDeepRefreshing(false)
                        onRefreshComplete()
                    }
                },
                onError: (error) => {
                    console.error("Refresh failed:", error)
                    toast.error(
                        "Failed to start refresh. Please try again.",
                        {
                            id: "bulk-refresh",
                        }
                    )
                    setRefreshType(null)
                    setIsDeepRefreshing(false)
                },
            })
        } else {
            // All feeds refresh
            refreshAllFeeds.mutate(undefined, {
                onSuccess: (data: any) => {
                    // Extract task ID if available for progress tracking
                    if (data && typeof data === 'object' && 'task_id' in data) {
                        setRefreshTaskId(data.task_id as string)
                    } else {
                        toast.success("Refresh started successfully!", {
                            id: "bulk-refresh",
                        })
                        setRefreshType(null)
                        setIsDeepRefreshing(false)
                        onRefreshComplete()
                    }
                },
                onError: (error) => {
                    console.error("Refresh failed:", error)
                    toast.error(
                        "Failed to start refresh. Please try again.",
                        {
                            id: "bulk-refresh",
                        }
                    )
                    setRefreshType(null)
                    setIsDeepRefreshing(false)
                },
            })
        }
    }

    /**
     * Stop/cancel current refresh
     */
    const stopRefresh = () => {
        setRefreshTaskId(null)
        setRefreshType(null)
        setIsDeepRefreshing(false)
        toast.dismiss("bulk-refresh")
    }

    // Handle refresh status updates
    useEffect(() => {
        if (!refreshStatus || typeof refreshStatus !== "object") return

        const statusData = refreshStatus as RefreshStatusResponse
        const status = statusData.status

        if (status === "completed") {
            const result = statusData.result
            if (result) {
                let message = `Refresh completed! ${result.refreshed_count} feeds refreshed successfully`

                if (result.failed_count > 0) {
                    message += `, ${result.failed_count} failed`

                    // Add error summary if available
                    if (result.error_summary) {
                        const errorTypes = Object.entries(result.error_summary)
                            .map(([type, count]: [string, number]) => {
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
                    duration: result.failed_count > 0 ? 8000 : 4000,
                })
            } else {
                toast.success("Refresh completed!", { id: "bulk-refresh" })
            }

            setRefreshTaskId(null)
            setRefreshType(null)
            setIsDeepRefreshing(false)
            onRefreshComplete()
        } else if (status === "failed") {
            toast.error("Refresh failed. Please try again.", {
                id: "bulk-refresh",
            })
            setRefreshTaskId(null)
            setRefreshType(null)
            setIsDeepRefreshing(false)
        } else if (status === "in_progress") {
            const progress = statusData.progress
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
                })
            }
        }
    }, [refreshStatus, refreshType, onRefreshComplete])

    return {
        refreshTaskId,
        refreshType,
        isDeepRefreshing,
        startRefresh,
        stopRefresh,
    }
}
