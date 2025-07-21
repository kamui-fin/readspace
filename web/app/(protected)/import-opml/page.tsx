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
import { RSS_QUERY_KEYS } from "@/lib/api/hooks/feeds"
import { useQueryClient } from "@tanstack/react-query"
import {
    CheckCircle,
    Upload,
    Clock,
    AlertCircle,
    FileText,
    Activity,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useRef, useState, useEffect } from "react"
import { toast } from "react-hot-toast"

// OPML import response types
interface OPMLImportResponse {
    processing_mode: "background"
    task_id: string
    message: string
    estimated_feeds: number
    check_status_url: string
    // Results when completed
    imported_count?: number
    failed_count?: number
    already_existed_count?: number
    total_feeds?: number
    errors?: Array<{
        url: string
        title: string
        error: string
        status: string
    }>
    summary?: {
        successful: number
        failed: number
        already_existed: number
    }
}

interface ImportStatus {
    task_id: string
    status: "pending" | "in_progress" | "completed" | "failed"
    message: string
    result?: OPMLImportResponse
    error?: string
    progress?: {
        completed: number
        total: number
        successful: number
        failed: number
        already_existed: number
    }
}

export default function ImportOPMLPage() {
    const [isUploading, setIsUploading] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [importResult, setImportResult] = useState<OPMLImportResponse | null>(
        null
    )
    const [backgroundTask, setBackgroundTask] = useState<{
        taskId: string
        estimatedFeeds: number
    } | null>(null)
    const [taskStatus, setTaskStatus] = useState<ImportStatus | null>(null)
    const [showDetails, setShowDetails] = useState(false)

    const fileInputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()
    const queryClient = useQueryClient()

    // Poll for background task status
    useEffect(() => {
        if (!backgroundTask) return

        const pollStatus = async () => {
            try {
                const status = (await ApiClient.rss.getImportTaskStatus(
                    backgroundTask.taskId
                )) as ImportStatus
                setTaskStatus(status)

                if (status.status === "completed") {
                    setImportResult(status.result!)
                    setBackgroundTask(null)
                    // Invalidate queries
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
                    ])

                    const summary = status.result?.summary
                    if (summary) {
                        toast.success(
                            `Import completed! ${summary.successful} feeds imported, ${summary.already_existed} already existed, ${summary.failed} failed.`
                        )
                    }
                } else if (status.status === "failed") {
                    setBackgroundTask(null)
                    toast.error(
                        `Import failed: ${status.error || "Unknown error"}`
                    )
                }
            } catch (error) {
                console.error("Error polling task status:", error)
                toast.error("Error checking import status")
            }
        }

        // Poll more frequently for better UX
        const interval = setInterval(pollStatus, 2000) // Poll every 2 seconds
        return () => clearInterval(interval)
    }, [backgroundTask, queryClient])

    const handleFileUpload = async (file: File) => {
        if (
            !file ||
            (!file.name.endsWith(".opml") && !file.name.endsWith(".xml"))
        ) {
            toast.error("Please select a valid OPML or XML file")
            return
        }

        const formData = new FormData()
        formData.append("opml_file", file)
        formData.append("default_folder_name", "Imported Feeds")

        setIsUploading(true)
        setImportResult(null)
        setBackgroundTask(null)
        setTaskStatus(null)

        try {
            const data = (await ApiClient.rss.importOPML(
                formData
            )) as OPMLImportResponse

            // All imports are now background
            setBackgroundTask({
                taskId: data.task_id,
                estimatedFeeds: data.estimated_feeds || 0,
            })
            toast.success(
                `Queued ${data.estimated_feeds} feeds for import processing.`
            )
        } catch (error) {
            console.error("Error uploading OPML file:", error)
            toast.error("Failed to import OPML file. Please try again.")
        } finally {
            setIsUploading(false)
        }
    }

    const renderImportResults = () => {
        if (!importResult) return null

        const { summary, errors } = importResult

        return (
            <Card className="mt-6">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <CheckCircle className="h-6 w-6 text-green-600" />
                        <CardTitle>Import Complete</CardTitle>
                    </div>
                    <CardDescription>
                        Your OPML file has been successfully processed.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                            <div className="text-2xl font-semibold text-green-600">
                                {summary?.successful || 0}
                            </div>
                            <div className="text-sm text-green-700">
                                Imported
                            </div>
                        </div>
                        <div className="text-center p-4 bg-blue-50 rounded-lg">
                            <div className="text-2xl font-semibold text-blue-600">
                                {summary?.already_existed || 0}
                            </div>
                            <div className="text-sm text-blue-700">
                                Already had
                            </div>
                        </div>
                        <div className="text-center p-4 bg-red-50 rounded-lg">
                            <div className="text-2xl font-semibold text-red-600">
                                {summary?.failed || 0}
                            </div>
                            <div className="text-sm text-red-700">Failed</div>
                        </div>
                    </div>

                    {errors && errors.length > 0 && (
                        <div className="border-t pt-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowDetails(!showDetails)}
                                className="text-muted-foreground hover:text-foreground"
                            >
                                {showDetails ? "Hide" : "Show"} failed feeds (
                                {errors.length})
                            </Button>

                            {showDetails && (
                                <div className="mt-3 max-h-48 overflow-y-auto space-y-2">
                                    {errors.map((error, index) => (
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

                    <div className="flex gap-3 pt-4">
                        <Button
                            onClick={() => router.push("/articles")}
                            className="flex-1"
                        >
                            View Articles
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setImportResult(null)
                                setShowDetails(false)
                                setTaskStatus(null)
                            }}
                        >
                            Import More
                        </Button>
                    </div>
                </CardContent>
            </Card>
        )
    }

    const renderBackgroundStatus = () => {
        if ((!backgroundTask && !taskStatus) || importResult) return null

        const progress = taskStatus?.progress
        const hasProgress = progress && progress.total > 0
        const progressPercentage = hasProgress
            ? (progress.completed / progress.total) * 100
            : 0

        return (
            <Card className="mt-6">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <Activity className="h-6 w-6 text-blue-600 animate-pulse" />
                        <CardTitle>Processing Import</CardTitle>
                    </div>
                    <CardDescription>
                        {hasProgress
                            ? `Processing ${progress.completed} of ${progress.total} feeds`
                            : `Processing ${backgroundTask?.estimatedFeeds || 0} feeds...`}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {hasProgress ? (
                        <>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm text-muted-foreground">
                                    <span>Progress</span>
                                    <span>
                                        {Math.round(progressPercentage)}%
                                    </span>
                                </div>
                                <Progress
                                    value={progressPercentage}
                                    className="h-2"
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-center text-sm">
                                <div className="p-3 bg-green-50 rounded">
                                    <div className="font-medium text-green-600">
                                        {progress.successful}
                                    </div>
                                    <div className="text-xs text-green-700">
                                        Imported
                                    </div>
                                </div>
                                <div className="p-3 bg-blue-50 rounded">
                                    <div className="font-medium text-blue-600">
                                        {progress.already_existed}
                                    </div>
                                    <div className="text-xs text-blue-700">
                                        Already had
                                    </div>
                                </div>
                                <div className="p-3 bg-red-50 rounded">
                                    <div className="font-medium text-red-600">
                                        {progress.failed}
                                    </div>
                                    <div className="text-xs text-red-700">
                                        Failed
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm text-muted-foreground">
                                <span>Initializing...</span>
                                <span className="capitalize">
                                    {taskStatus?.status || "pending"}
                                </span>
                            </div>
                            <Progress value={undefined} className="h-2" />
                        </div>
                    )}
                </CardContent>
            </Card>
        )
    }

    const handleFileDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files[0])
        }
    }, [])

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
    }, [])

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileUpload(e.target.files[0])
        }
    }

    const handleButtonClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click()
        }
    }

    return (
        <div className="container mx-auto p-6 max-w-4xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">OPML Import</h1>
                <p className="text-muted-foreground">
                    Import feeds from an OPML file exported from another RSS
                    reader.
                </p>
            </div>

            {!importResult && !backgroundTask && (
                <Card
                    className={`transition-colors duration-200 ${
                        isDragging
                            ? "border-primary bg-primary/5"
                            : "border-dashed border-2"
                    }`}
                    onDrop={handleFileDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                >
                    <CardContent className="p-12">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileInputChange}
                            accept=".opml,.xml"
                            className="hidden"
                        />
                        <div className="flex flex-col items-center justify-center gap-4 text-center">
                            <div className="p-4 bg-muted rounded-full">
                                <Upload
                                    size={48}
                                    className="text-muted-foreground"
                                />
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-lg font-medium">
                                    {isDragging
                                        ? "Drop your OPML file here"
                                        : "Upload OPML File"}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Drag and drop or click to select a .opml or
                                    .xml file
                                </p>
                            </div>

                            <Button
                                onClick={handleButtonClick}
                                disabled={isUploading}
                                size="lg"
                                className="mt-4"
                            >
                                {isUploading ? (
                                    <>
                                        <Clock className="mr-2 h-4 w-4 animate-spin" />
                                        Uploading...
                                    </>
                                ) : (
                                    <>
                                        <FileText className="mr-2 h-4 w-4" />
                                        Choose File
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {renderBackgroundStatus()}
            {renderImportResults()}
        </div>
    )
}
