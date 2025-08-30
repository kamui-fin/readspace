"use client"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { ApiClient } from "@/lib/api/client"
import { RSS_QUERY_KEYS } from "@/lib/query-keys"
import { useQueryClient } from "@tanstack/react-query"
import {
    CheckCircle,
    AlertCircle,
    Clock,
    FileText,
    Activity,
    XCircle,
    ChevronLeft,
    Download,
    X,
} from "lucide-react"
import { useRouter, useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "react-hot-toast"

// Import status response types
interface ImportTaskStatus {
    task_id: string
    status: "pending" | "in_progress" | "completed" | "failed"
    message?: string
    result?: {
        imported_count: number
        failed_count: number
        already_existed_count: number
        total_feeds: number
        summary: {
            successful: number
            failed: number
            already_existed: number
        }
        errors?: Array<{
            url: string
            title: string
            error: string
            status: string
        }>
    }
    error?: string
    progress?: {
        completed: number
        total: number
        successful: number
        failed: number
        already_existed: number
    }
    metadata?: {
        user_id: string
        task_id: string
        estimated_feeds: number
        filename: string
        created_at: string
        status: string
    }
}

export default function ImportStatusPage() {
    const [taskStatus, setTaskStatus] = useState<ImportTaskStatus | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showErrorDetails, setShowErrorDetails] = useState(false)

    const params = useParams()
    const router = useRouter()
    const queryClient = useQueryClient()
    const taskId = params.task_id as string

    const handleCancelImport = async () => {
        try {
            await ApiClient.rss.cancelImportTask(taskId)
            toast.success("Import cancelled successfully")
            
            // Force refresh the task status
            const status = await ApiClient.rss.getImportTaskStatus(taskId)
            setTaskStatus(status as ImportTaskStatus)
        } catch (error) {
            console.error("Error cancelling import task:", error)
            toast.error("Failed to cancel import. It may have already completed.")
        }
    }

    // Poll for task status
    useEffect(() => {
        if (!taskId) return

        let pollInterval: NodeJS.Timeout | null = null

        const pollStatus = async () => {
            try {
                const status = await ApiClient.rss.getImportTaskStatus(taskId) as ImportTaskStatus
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
            } catch (error: any) {
                console.error("Error polling task status:", error)
                
                if (error?.message?.includes("404")) {
                    setError("Import task not found or has expired. This may happen if the task was completed long ago or if there was a system restart.")
                } else if (error?.message?.includes("403")) {
                    setError("You don't have permission to view this import task.")
                } else {
                    setError("Error checking import status. Please try refreshing the page.")
                }
                
                // Stop polling on error
                if (pollInterval) {
                    clearInterval(pollInterval)
                    pollInterval = null
                }
            } finally {
                setIsLoading(false)
            }
        }

        // Initial load
        pollStatus()

        // Start polling interval
        pollInterval = setInterval(() => {
            // Only continue polling if we don't have an error and task is still active
            if (!error && taskStatus?.status && !["completed", "failed"].includes(taskStatus.status)) {
                pollStatus()
            } else if (taskStatus?.status && ["completed", "failed"].includes(taskStatus.status)) {
                // Stop polling when task is done
                if (pollInterval) {
                    clearInterval(pollInterval)
                    pollInterval = null
                }
            }
        }, 2000) // Poll every 2 seconds

        return () => {
            if (pollInterval) {
                clearInterval(pollInterval)
            }
        }
    }, [taskId, queryClient, error, taskStatus?.status])

    const renderStatus = () => {
        if (isLoading) {
            return (
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <Activity className="h-6 w-6 text-blue-600 animate-pulse" />
                            <CardTitle>Loading Import Status...</CardTitle>
                        </div>
                    </CardHeader>
                </Card>
            )
        }

        if (error) {
            return (
                <Card className="border-red-200 bg-red-50/50">
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <XCircle className="h-6 w-6 text-red-600" />
                            <CardTitle>Task Not Found</CardTitle>
                        </div>
                        <CardDescription className="text-red-700">
                            {error}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="text-sm text-muted-foreground">
                            <p>This can happen if:</p>
                            <ul className="list-disc list-inside mt-2 space-y-1">
                                <li>The import was completed or failed long ago</li>
                                <li>The task data expired from temporary storage</li>
                                <li>There was a system restart</li>
                            </ul>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button onClick={() => router.push("/import-opml")} className="flex-1">
                                Start New Import
                            </Button>
                            <Button 
                                variant="outline" 
                                onClick={() => router.push("/feeds")}
                            >
                                View Feeds
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )
        }

        if (!taskStatus) return null

        const { status, progress, result, metadata } = taskStatus


        return (
            <div className="space-y-6">

                {/* Progress Card (for in-progress imports) */}
                {status === "in_progress" && progress && (
                    <Card>
                        <CardHeader className="pb-4">
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <Activity className="h-6 w-6 text-blue-600 animate-pulse flex-shrink-0 mt-0.5" />
                                    <div className="min-w-0 flex-1">
                                        <CardTitle className="text-lg mb-3">Import in Progress</CardTitle>
                                        <div className="space-y-2">
                                            {metadata?.filename && (
                                                <div className="flex items-center gap-2">
                                                    <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                                    <span className="text-sm text-muted-foreground truncate">{metadata.filename}</span>
                                                </div>
                                            )}
                                            <div className="text-sm text-muted-foreground">
                                                Processing {progress.completed} of {progress.total} feeds
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {metadata?.created_at && (
                                    <div className="text-xs text-muted-foreground pl-9">
                                        Started: {new Date(metadata.created_at).toLocaleString()}
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm text-muted-foreground">
                                    <span>Progress</span>
                                    <span>
                                        {Math.round((progress.completed / progress.total) * 100)}%
                                    </span>
                                </div>
                                <Progress
                                    value={(progress.completed / progress.total) * 100}
                                    className="h-2"
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                                <div className="flex items-center justify-between sm:flex-col sm:text-center p-4 bg-green-50 rounded-lg">
                                    <div className="flex items-center gap-3 sm:flex-col sm:gap-1">
                                        <div className="text-2xl font-semibold text-green-600">
                                            {progress.successful}
                                        </div>
                                        <div className="text-sm font-medium text-green-700">
                                            Successfully Imported
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between sm:flex-col sm:text-center p-4 bg-blue-50 rounded-lg">
                                    <div className="flex items-center gap-3 sm:flex-col sm:gap-1">
                                        <div className="text-2xl font-semibold text-blue-600">
                                            {progress.already_existed}
                                        </div>
                                        <div className="text-sm font-medium text-blue-700">
                                            Already Existed
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between sm:flex-col sm:text-center p-4 bg-red-50 rounded-lg">
                                    <div className="flex items-center gap-3 sm:flex-col sm:gap-1">
                                        <div className="text-2xl font-semibold text-red-600">
                                            {progress.failed}
                                        </div>
                                        <div className="text-sm font-medium text-red-700">
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
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                    <X className="h-4 w-4 mr-2" />
                                    Cancel Import
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Results Card (for completed imports) */}
                {status === "completed" && result && (
                    <Card>
                        <CardHeader className="pb-4">
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                                    <div className="min-w-0 flex-1">
                                        <CardTitle className="text-lg mb-3">Import Complete</CardTitle>
                                        <div className="space-y-2">
                                            {metadata?.filename && (
                                                <div className="flex items-center gap-2">
                                                    <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                                    <span className="text-sm text-muted-foreground truncate">{metadata.filename}</span>
                                                </div>
                                            )}
                                            <div className="text-sm text-muted-foreground">
                                                Your OPML file has been successfully processed.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {metadata?.created_at && (
                                    <div className="text-xs text-muted-foreground pl-9">
                                        Started: {new Date(metadata.created_at).toLocaleString()}
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="flex items-center justify-between sm:flex-col sm:text-center p-4 bg-green-50 rounded-lg">
                                    <div className="flex items-center gap-3 sm:flex-col sm:gap-2">
                                        <div className="text-2xl font-semibold text-green-600">
                                            {result.summary?.successful || 0}
                                        </div>
                                        <div className="text-sm font-medium text-green-700">
                                            Successfully Imported
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between sm:flex-col sm:text-center p-4 bg-blue-50 rounded-lg">
                                    <div className="flex items-center gap-3 sm:flex-col sm:gap-2">
                                        <div className="text-2xl font-semibold text-blue-600">
                                            {result.summary?.already_existed || 0}
                                        </div>
                                        <div className="text-sm font-medium text-blue-700">
                                            Already Existed
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between sm:flex-col sm:text-center p-4 bg-red-50 rounded-lg">
                                    <div className="flex items-center gap-3 sm:flex-col sm:gap-2">
                                        <div className="text-2xl font-semibold text-red-600">
                                            {result.summary?.failed || 0}
                                        </div>
                                        <div className="text-sm font-medium text-red-700">
                                            Import Failed
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {result.errors && result.errors.length > 0 && (
                                <div className="border-t pt-4">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowErrorDetails(!showErrorDetails)}
                                        className="text-muted-foreground hover:text-foreground"
                                    >
                                        {showErrorDetails ? "Hide" : "Show"} failed feeds (
                                        {result.errors.length})
                                    </Button>

                                    {showErrorDetails && (
                                        <div className="mt-3 max-h-48 overflow-y-auto space-y-2">
                                            {result.errors.map((error, index) => (
                                                <div
                                                    key={index}
                                                    className="bg-red-50 border border-red-200 rounded p-3 text-sm"
                                                >
                                                    <div className="font-medium text-red-900">
                                                        {error.title || "Unknown feed"}
                                                    </div>
                                                    <div className="text-red-700 text-xs mt-1 truncate">
                                                        {error.url}
                                                    </div>
                                                    <div className="text-red-600 text-xs mt-1">
                                                        {error.error}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex flex-col sm:flex-row gap-3 pt-4">
                                <Button
                                    onClick={() => router.push("/articles")}
                                    className="flex-1"
                                >
                                    View Articles
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => router.push("/import-opml")}
                                >
                                    Import More
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Pending Card */}
                {status === "pending" && (
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Clock className="h-6 w-6 text-yellow-600" />
                                    <div>
                                        <CardTitle>Import Queued</CardTitle>
                                        <CardDescription className="flex items-center gap-2">
                                            {metadata?.filename && (
                                                <>
                                                    <FileText className="h-4 w-4" />
                                                    {metadata.filename} •
                                                </>
                                            )}
                                            Your OPML import is queued and will start processing shortly.
                                            {metadata?.estimated_feeds && (
                                                <span> Estimated {metadata.estimated_feeds} feeds to process.</span>
                                            )}
                                        </CardDescription>
                                    </div>
                                </div>
                                {metadata?.created_at && (
                                    <div className="text-xs sm:text-sm text-muted-foreground break-words">
                                        Started: {new Date(metadata.created_at).toLocaleString()}
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCancelImport}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                                <X className="h-4 w-4 mr-2" />
                                Cancel Import
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Failed Card */}
                {status === "failed" && (
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <XCircle className="h-6 w-6 text-red-600" />
                                    <div>
                                        <CardTitle>Import Failed</CardTitle>
                                        <CardDescription className="flex items-center gap-2">
                                            {metadata?.filename && (
                                                <>
                                                    <FileText className="h-4 w-4" />
                                                    {metadata.filename} •
                                                </>
                                            )}
                                            {taskStatus.error || "The import process encountered an error."}
                                        </CardDescription>
                                    </div>
                                </div>
                                {metadata?.created_at && (
                                    <div className="text-xs sm:text-sm text-muted-foreground break-words">
                                        Started: {new Date(metadata.created_at).toLocaleString()}
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => router.push("/import-opml")}
                                >
                                    Try Again
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        )
    }

    return (
        <div className="container mx-auto p-4 sm:p-6 pt-6 sm:pt-10 max-w-4xl">
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push("/import-opml")}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Back to Import
                    </Button>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold">OPML Import Status</h1>
                <p className="text-muted-foreground">
                    Track the progress of your OPML import.
                </p>
            </div>

            {renderStatus()}
        </div>
    )
} 