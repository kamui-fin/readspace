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
import { Alert, AlertDescription } from "@/components/ui/alert"
import Header from "@/components/navigation/header"
import { ApiClient } from "@/lib/api/client"
import { RSS_QUERY_KEYS } from "@/lib/query-keys"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
    CheckCircle,
    Upload,
    Clock,
    AlertCircle,
    FileText,
    Activity,
    ExternalLink,
    Info,
    X,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useRef, useState } from "react"
import { toast } from "react-hot-toast"

// OPML import response types
interface OPMLImportResponse {
    processing_mode: "background"
    task_id: string
    message: string
    estimated_feeds: number
    check_status_url: string
    status_page_url: string
}

interface ActiveImportTask {
    user_id: string
    task_id: string
    estimated_feeds: number
    filename: string
    created_at: string
    status: string
    current_status?: string
}

export default function ImportOPMLPageClient() {
    const [isUploading, setIsUploading] = useState(false)
    const [isDragging, setIsDragging] = useState(false)

    const fileInputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()
    const queryClient = useQueryClient()

    // Use the prefetched data for active imports
    const { data: activeImports = [], isLoading: isLoadingActiveImports } = useQuery<ActiveImportTask[]>({
        queryKey: [RSS_QUERY_KEYS.OPML_IMPORT_TASKS],
        queryFn: () => ApiClient.rss.listImportTasks(),
        refetchInterval: 5000, // Poll every 5 seconds for updates
    })

    const handleFileUpload = async (file: File) => {
        // Check if there's already an active import
        if (activeImports.length > 0) {
            toast.error("Please wait for the current import to complete before starting a new one.")
            return
        }

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

        try {
            const data = (await ApiClient.rss.importOPML(
                formData
            )) as OPMLImportResponse

            // Redirect to the status page immediately
            router.push(`/import-opml/status/${data.task_id}`)

            // Show success message
            toast.success(
                `Queued ${data.estimated_feeds} feeds for import processing.`
            )

        } catch (error) {
            console.error("Error uploading OPML file:", error)
            toast.error("Failed to import OPML file. Please try again.")
            setIsUploading(false)
        }
    }

    const handleCancelImport = async (taskId: string) => {
        try {
            await ApiClient.rss.cancelImportTask(taskId)
            toast.success("Import cancelled successfully")
            
            // Invalidate the import tasks query to refetch
            queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.OPML_IMPORT_TASKS] })
        } catch (error) {
            console.error("Error cancelling import task:", error)
            toast.error("Failed to cancel import. It may have already completed.")
        }
    }

    const renderActiveImports = () => {
        if (isLoadingActiveImports) {
            return (
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <Activity className="h-5 w-5 text-blue-600 animate-pulse" />
                            <CardTitle className="text-lg">Checking for active imports...</CardTitle>
                        </div>
                    </CardHeader>
                </Card>
            )
        }

        if (activeImports.length === 0) {
            return null
        }

        // Only show the first (most recent) active import
        const activeImport = activeImports[0]

        return (
            <div className="space-y-4">
                <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                        You have an active import in progress. Only one import can run at a time.
                    </AlertDescription>
                </Alert>

                <Card className="border border-blue-200 bg-blue-50/50">
                    <CardHeader className="pb-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <Activity className="h-5 w-5 text-blue-600" />
                                <div className="min-w-0 flex-1">
                                    <CardTitle className="text-base sm:text-lg flex flex-col sm:flex-row sm:items-center gap-2">
                                        <span>Import in Progress</span>
                                        {activeImport.current_status && (
                                            <span className="text-sm font-normal text-muted-foreground capitalize">
                                                ({activeImport.current_status.replace('_', ' ')})
                                            </span>
                                        )}
                                    </CardTitle>
                                    <CardDescription className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-1">
                                        <span className="flex items-center gap-2">
                                            <FileText className="h-4 w-4" />
                                            <span className="truncate">{activeImport.filename}</span>
                                        </span>
                                        <span className="text-xs sm:text-sm">
                                            {activeImport.estimated_feeds} feeds
                                        </span>
                                    </CardDescription>
                                </div>
                            </div>
                            <div className="text-left sm:text-right">
                                <div className="text-xs sm:text-sm text-muted-foreground">
                                    Started: {new Date(activeImport.created_at).toLocaleString()}
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push(`/import-opml/status/${activeImport.task_id}`)}
                                className="flex-1"
                            >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                View Progress
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCancelImport(activeImport.task_id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 sm:w-auto"
                            >
                                <X className="h-4 w-4 mr-2" />
                                Cancel
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
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
        <div className="flex flex-col min-h-screen">
            <Header
                breadcrumbItems={[{ href: "/import-opml", label: "OPML Import" }]}
            />
            <main className="flex-1">
                <div className="container mx-auto p-4 sm:p-6 pt-6 sm:pt-10 max-w-4xl">
                    <div className="mb-8">
                        <h1 className="text-2xl sm:text-3xl font-bold mb-2">OPML Import</h1>
                        <p className="text-muted-foreground">
                            Import feeds from an OPML file exported from another RSS
                            reader.
                        </p>
                    </div>

            {/* Active Imports Section */}
            {(activeImports.length > 0 || isLoadingActiveImports) && (
                <div className="mb-8">
                    {renderActiveImports()}
                </div>
            )}

            {/* Upload Section - Only show if no active imports */}
            {activeImports.length === 0 && (
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

            {/* Message when upload is disabled due to active import */}
            {activeImports.length > 0 && (
                <Card className="border-gray-200 bg-gray-50/50">
                    <CardContent className="p-12 text-center">
                        <div className="flex flex-col items-center justify-center gap-4">
                            <div className="p-4 bg-gray-200 rounded-full">
                                <Upload size={48} className="text-gray-400" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-lg font-medium text-gray-600">
                                    Upload Disabled
                                </h3>
                                <p className="text-sm text-gray-500">
                                    Complete or cancel your current import before starting a new one
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
                </div>
            </main>
        </div>
    )
}