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
                {status === "in_progress" && (
                    <ProgressCard
                        task={taskStatus}
                        onCancel={handleCancelImport}
                        isCancelling={isCancelling}
                    />
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
