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
    ExternalLink,
    Info,
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

export default function ImportOPMLPage() {
    const [isUploading, setIsUploading] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [activeImports, setActiveImports] = useState<ActiveImportTask[]>([])
    const [isLoadingActiveImports, setIsLoadingActiveImports] = useState(true)

    const fileInputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()
    const queryClient = useQueryClient()

    // Check for active imports when page loads
    useEffect(() => {
        const checkActiveImports = async () => {
            try {
                const tasks = await ApiClient.rss.listImportTasks()
                setActiveImports(tasks)
            } catch (error) {
                console.error("Error checking active imports:", error)
                // Don't show error to user for this, just log it
                // This is not critical functionality
            } finally {
                setIsLoadingActiveImports(false)
            }
        }

        checkActiveImports()
    }, [])

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

        try {
            const data = (await ApiClient.rss.importOPML(
                formData
            )) as OPMLImportResponse

            // Show success message
            toast.success(
                `Queued ${data.estimated_feeds} feeds for import processing.`
            )

            // Redirect to the status page
            router.push(`/import-opml/status/${data.task_id}`)

        } catch (error) {
            console.error("Error uploading OPML file:", error)
            toast.error("Failed to import OPML file. Please try again.")
            setIsUploading(false)
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

        return (
            <div className="space-y-4">
                <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                        You have {activeImports.length} active import{activeImports.length > 1 ? 's' : ''} in progress.
                    </AlertDescription>
                </Alert>

                <div className="grid gap-4">
                    {activeImports.map((task) => (
                        <Card key={task.task_id} className="border border-blue-200 bg-blue-50/50">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Activity className="h-5 w-5 text-blue-600" />
                                        <div>
                                            <CardTitle className="text-lg flex items-center gap-2">
                                                Import in Progress
                                                {task.current_status && (
                                                    <span className="text-sm font-normal text-muted-foreground capitalize">
                                                        ({task.current_status.replace('_', ' ')})
                                                    </span>
                                                )}
                                            </CardTitle>
                                            <CardDescription className="flex items-center gap-2">
                                                <FileText className="h-4 w-4" />
                                                {task.filename} • {task.estimated_feeds} feeds
                                            </CardDescription>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm text-muted-foreground">
                                            Started: {new Date(task.created_at).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => router.push(`/import-opml/status/${task.task_id}`)}
                                    className="w-full"
                                >
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    View Progress
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
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
        <div className="container mx-auto p-6 pt-10 max-w-4xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">OPML Import</h1>
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

            {/* Upload Section */}
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
        </div>
    )
}
