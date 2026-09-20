"use client"

import { Button } from "@/components/ui/button"
import {
    RSS_QUERY_KEYS,
    useCancelImportTask,
    useImportTaskStatus,
} from "@readspace/shared"
import { useQueryClient } from "@tanstack/react-query"
import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "react-hot-toast"
import { LoadingCard } from "@/components/features/opml/status/LoadingCard"
import { ErrorCard } from "@/components/features/opml/status/ErrorCard"
import { ProgressCard } from "@/components/features/opml/status/ProgressCard"
import { ResultsCard } from "@/components/features/opml/status/ResultsCard"
import { PendingCard } from "@/components/features/opml/status/PendingCard"
import { FailedCard } from "@/components/features/opml/status/FailedCard"

export default function ImportStatusPage() {
    const params = useParams()
    const queryClient = useQueryClient()
    const taskId = params.task_id as string

    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    const {
        data: taskStatus,
        isLoading,
        error: statusError,
    } = useImportTaskStatus(taskId)
    const cancelImportMutation = useCancelImportTask()
    const router = useRouter()

    const handleCancelImport = async () => {
        try {
            const response = await cancelImportMutation.mutateAsync(taskId)

            // Check if cancellation was successful
            if (response.cancelled) {
                toast.success("Import cancelled successfully")
                router.push("/import-opml")
            } else {
                toast.success(response.message || "Task was already completed")
                router.push("/import-opml")
            }
        } catch (error) {
            console.error("Error cancelling import task:", error)
            toast.error(
                "Failed to cancel import. It may have already completed."
            )
        }
    }

    const isCancelling = cancelImportMutation.isPending

    // Invalidate queries when import completes
    useEffect(() => {
<<<<<<< Updated upstream
        if (taskStatus?.status === "completed") {
            const invalidate = async () => {
                await Promise.all([
                    queryClient.invalidateQueries({
                        queryKey: [RSS_QUERY_KEYS.FEEDS],
                    }),
                    queryClient.invalidateQueries({
                        queryKey: [RSS_QUERY_KEYS.FOLDERS],
                    }),
                    queryClient.invalidateQueries({
                        queryKey: [RSS_QUERY_KEYS.ARTICLES],
                    }),
                    queryClient.invalidateQueries({
                        queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
                    }),
                    queryClient.invalidateQueries({
                        queryKey: [RSS_QUERY_KEYS.OPML_IMPORT_TASKS],
                    }),
                ])
=======
        if (!taskId) return

        let pollInterval: ReturnType<typeof setInterval> | null = null

        const pollStatus = async () => {
            try {
                const status = (await ApiClient.rss.getImportTaskStatus(
                    taskId
                )) as ImportTaskStatus
                setTaskStatus(status)
                setError(null)

                if (status.status === "completed") {
                    // Invalidate queries when import completes
                    await Promise.all([
                        queryClient.invalidateQueries({
                            queryKey: [RSS_QUERY_KEYS.FEEDS],
                        }),
                        queryClient.invalidateQueries({
                            queryKey: [RSS_QUERY_KEYS.FOLDERS],
                        }),
                        queryClient.invalidateQueries({
                            queryKey: [RSS_QUERY_KEYS.ARTICLES],
                        }),
                        queryClient.invalidateQueries({
                            queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
                        }),
                        queryClient.invalidateQueries({
                            queryKey: [RSS_QUERY_KEYS.OPML_IMPORT_TASKS],
                        }),
                    ])
                } else if (status.status === "failed") {
                    toast.error(
                        `Import failed: ${status.error || "Unknown error"}`
                    )
                }
            } catch (error: unknown) {
                console.error("Error polling task status:", error)

                if (error instanceof Error) {
                    if (error.message.includes("404")) {
                        setError(
                            "Import task not found or has expired. This may happen if the task was completed long ago or if there was a system restart."
                        )
                    } else if (error.message.includes("403")) {
                        setError(
                            "You don't have permission to view this import task."
                        )
                    } else {
                        setError(
                            "Error checking import status. Please try refreshing the page."
                        )
                    }
                } else {
                    setError("An unknown error occurred.")
                }

                // Stop polling on error
                if (pollInterval) {
                    clearInterval(pollInterval)
                    pollInterval = null
                }
            } finally {
                setIsLoading(false)
>>>>>>> Stashed changes
            }
            invalidate()
        } else if (taskStatus?.status === "failed") {
            toast.error(`Import failed: ${taskStatus.error || "Unknown error"}`)
        }
    }, [taskStatus?.status, taskStatus?.error, queryClient])

    // Handle errors
    useEffect(() => {
        if (statusError) {
            if (statusError.message.includes("404")) {
                setErrorMsg(
                    "Import task not found or has expired. This may happen if the task was completed long ago or if there was a system restart."
                )
            } else if (statusError.message.includes("403")) {
                setErrorMsg(
                    "You don't have permission to view this import task."
                )
            } else {
                setErrorMsg(
                    "Error checking import status. Please try refreshing the page."
                )
            }
        } else {
            setErrorMsg(null)
        }
    }, [statusError])

    const renderStatus = () => {
        if (isLoading) {
            return <LoadingCard />
        }

        if (errorMsg) {
            return <ErrorCard message={errorMsg} />
        }

        if (!taskStatus) return null

        const { status } = taskStatus

        return (
            <div className="space-y-6">
                {/* Progress Card (for in-progress imports) */}
<<<<<<< Updated upstream
                {status === "in_progress" && (
                    <ProgressCard
                        task={taskStatus}
                        onCancel={handleCancelImport}
                        isCancelling={isCancelling}
                    />
=======
                {status === "in_progress" && progress && (
                    <Card>
                        <CardHeader className="pb-4">
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <Activity className="h-6 w-6 text-blue-600 animate-pulse flex-shrink-0 mt-0.5" />
                                    <div className="min-w-0 flex-1">
                                        <CardTitle className="text-lg mb-3">
                                            Import in Progress
                                        </CardTitle>
                                        <div className="space-y-2">
                                            {metadata?.filename && (
                                                <div className="flex items-center gap-2">
                                                    <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                                    <span className="text-sm text-muted-foreground truncate">
                                                        {metadata.filename}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="text-sm text-muted-foreground">
                                                Processing {progress.completed}{" "}
                                                of {progress.total} feeds
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {metadata?.created_at && (
                                    <div className="text-xs text-muted-foreground pl-9">
                                        Started:{" "}
                                        {new Date(
                                            metadata.created_at
                                        ).toLocaleString()}
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm text-muted-foreground">
                                    <span>Progress</span>
                                    <span>
                                        {Math.round(
                                            (progress.completed /
                                                progress.total) *
                                            100
                                        )}
                                        %
                                    </span>
                                </div>
                                <Progress
                                    value={
                                        (progress.completed / progress.total) *
                                        100
                                    }
                                    className="h-2"
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                                <div className="flex items-center justify-between sm:flex-col sm:text-center p-4 bg-secondary/10 rounded-lg border border-secondary/20">
                                    <div className="flex items-center gap-3 sm:flex-col sm:gap-1">
                                        <div className="text-2xl font-semibold text-secondary">
                                            {progress.successful}
                                        </div>
                                        <div className="text-sm font-medium text-secondary">
                                            Successfully Imported
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between sm:flex-col sm:text-center p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                                    <div className="flex items-center gap-3 sm:flex-col sm:gap-1">
                                        <div className="text-2xl font-semibold text-yellow-700 dark:text-yellow-400">
                                            {progress.already_existed}
                                        </div>
                                        <div className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                                            Already Existed
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between sm:flex-col sm:text-center p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                                    <div className="flex items-center gap-3 sm:flex-col sm:gap-1">
                                        <div className="text-2xl font-semibold text-destructive">
                                            {progress.failed}
                                        </div>
                                        <div className="text-sm font-medium text-destructive">
                                            Import Failed
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="pt-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCancelImport}
                                    className="text-destructive hover:text-destructive"
                                >
                                    <X className="h-4 w-4 mr-2" />
                                    Cancel Import
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
>>>>>>> Stashed changes
                )}

                {/* Results Card (for completed imports) */}
                {status === "completed" && <ResultsCard task={taskStatus} />}

                {/* Pending Card */}
                {status === "pending" && (
                    <PendingCard
                        task={taskStatus}
                        onCancel={handleCancelImport}
                        isCancelling={isCancelling}
                    />
                )}

                {/* Failed Card */}
                {status === "failed" && <FailedCard task={taskStatus} />}
            </div>
        )
    }

    return (
        <div className="container mx-auto p-4 sm:p-6 pt-6 sm:pt-10 max-w-4xl">
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <Link href="/import-opml">
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Back to Import
                        </Link>
                    </Button>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold">
                    OPML Import Status
                </h1>
                <p className="text-muted-foreground">
                    Track the progress of your OPML import.
                </p>
            </div>

            {renderStatus()}
        </div>
    )
}
