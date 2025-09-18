"use client"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Header from "@/components/navigation/header"
import { ApiClient, ActiveImportTask } from "@readspace/shared"
import { RSS_QUERY_KEYS } from "@readspace/shared"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
    Upload,
    Clock,
    FileText,
    Activity,
    ExternalLink,
    Info,
    X,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useRef, useState } from "react"
import { toast } from "react-hot-toast"
import { opml } from "@readspace/shared"

// OPML import response types
interface OPMLImportResponse {
    processing_mode: "background"
    task_id: string
    message: string
    estimated_feeds: number
    check_status_url: string
    status_page_url: string
}

export default function ImportOPMLPageClient() {
    const [isUploading, setIsUploading] = useState(false)
    const [isDragging, setIsDragging] = useState(false)

    const fileInputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()
    const queryClient = useQueryClient()

    // Use the prefetched data for active imports
    const { data: activeImports = [], isLoading: isLoadingActiveImports } =
        useQuery<ActiveImportTask[]>({
            queryKey: [RSS_QUERY_KEYS.OPML_IMPORT_TASKS],
            queryFn: () => ApiClient.rss.listImportTasks(),
            refetchInterval: 5000, // Poll every 5 seconds for updates
        })

    const validateOpmlFile = useCallback(
        async (
            file: File
        ): Promise<{
            isValid: boolean
            feedCount: number
            hasNestedCategories: boolean
            error?: string
        }> => {
            try {
                const content = await file.text()

                // Check if this is an RSS/Atom feed instead of OPML
                const contentLower = content.toLowerCase().trim()
                if (
                    contentLower.includes("<rss") ||
                    contentLower.includes("<feed") ||
                    (contentLower.includes("<channel>") &&
                        !contentLower.includes("<opml"))
                ) {
                    return {
                        isValid: false,
                        feedCount: 0,
                        hasNestedCategories: false,
                        error: "This appears to be an RSS/Atom feed file, not an OPML file. OPML files contain lists of feeds, while RSS/Atom files contain actual feed content. Please export your feed list as OPML from your RSS reader.",
                    }
                }

                const parsedOpml = opml.parse(content)

                if (!parsedOpml || !parsedOpml.opml || !parsedOpml.opml.body) {
                    return {
                        isValid: false,
                        feedCount: 0,
                        hasNestedCategories: false,
                        error: "Invalid OPML format: This doesn't appear to be a valid OPML file. Please check that you've exported the correct file from your RSS reader.",
                    }
                }

                let feedCount = 0
                let hasNestedCategories = false
                const existingUrls = new Set<string>()

                interface OpmlOutline {
                    xmlUrl?: string
                    subs?: OpmlOutline[]
                    [key: string]: unknown
                }

                const countFeeds = (outlines: OpmlOutline[], level = 0) => {
                    if (level > 1) {
                        hasNestedCategories = true
                    }

                    for (const outline of outlines || []) {
                        if (outline.xmlUrl) {
                            if (!existingUrls.has(outline.xmlUrl)) {
                                feedCount++
                                existingUrls.add(outline.xmlUrl)
                            }
                        } else if (outline.subs) {
                            countFeeds(outline.subs, level + 1)
                        }
                    }
                }

                countFeeds(parsedOpml.opml.body.subs)

                return {
                    isValid: feedCount > 0,
                    feedCount,
                    hasNestedCategories,
                    error:
                        feedCount === 0
                            ? "No valid RSS feeds found in OPML file"
                            : undefined,
                }
            } catch (error) {
                return {
                    isValid: false,
                    feedCount: 0,
                    hasNestedCategories: false,
                    error: `Failed to parse OPML file: ${error instanceof Error ? error.message : "Unknown error"}`,
                }
            }
        },
        []
    )

    const handleFileUpload = useCallback(
        async (file: File) => {
            // Check if there's already an active import
            if (activeImports.length > 0) {
                toast.error(
                    "Please wait for the current import to complete before starting a new one."
                )
                return
            }

            if (
                !file ||
                (!file.name.endsWith(".opml") && !file.name.endsWith(".xml"))
            ) {
                toast.error("Please select a valid OPML or XML file")
                return
            }

            // Validate OPML file
            const validation = await validateOpmlFile(file)
            if (!validation.isValid) {
                toast.error(validation.error || "Invalid OPML file")
                return
            }

            if (validation.hasNestedCategories) {
                toast.error(
                    "OPML files with nested categories are not supported. Please flatten your categories before importing."
                )
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

                // Show success message with better context
                toast.success(
                    `Processing ${validation.feedCount} feeds. Import will run silently in background.`
                )
            } catch (error) {
                console.error("Error uploading OPML file:", error)
                toast.error("Failed to import OPML file. Please try again.")
                setIsUploading(false)
            }
        },
        [activeImports, router, validateOpmlFile]
    )

    const handleCancelImport = async (taskId: string) => {
        try {
            await ApiClient.rss.cancelImportTask(taskId)
            toast.success("Import cancelled successfully")

            // Invalidate the import tasks query to refetch
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.OPML_IMPORT_TASKS],
            })
        } catch (error) {
            console.error("Error cancelling import task:", error)
            toast.error(
                "Failed to cancel import. It may have already completed."
            )
        }
    }

    const renderActiveImports = () => {
        if (isLoadingActiveImports) {
            return (
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <Activity className="h-5 w-5 text-blue-600 animate-pulse" />
                            <CardTitle className="text-lg">
                                Checking for active imports...
                            </CardTitle>
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
                        You have an active import in progress. Only one import
                        can run at a time.
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
                                        {activeImport?.current_status && (
                                            <span className="text-sm font-normal text-muted-foreground capitalize">
                                                (
                                                {activeImport.current_status.replace(
                                                    "_",
                                                    " "
                                                )}
                                                )
                                            </span>
                                        )}
                                    </CardTitle>
                                    <CardDescription className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-1">
                                        <span className="flex items-center gap-2">
                                            <FileText className="h-4 w-4" />
                                            <span className="truncate">
                                                {activeImport?.filename}
                                            </span>
                                        </span>
                                        <span className="text-xs sm:text-sm">
                                            {activeImport?.estimated_feeds} feeds
                                        </span>
                                    </CardDescription>
                                </div>
                            </div>
                            <div className="text-left sm:text-right">
                                <div className="text-xs sm:text-sm text-muted-foreground">
                                    Started:{" "}
                                    {activeImport?.created_at ? new Date(
                                        activeImport.created_at
                                    ).toLocaleString() : 'Unknown'}
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    activeImport?.task_id && router.push(
                                        `/import-opml/status/${activeImport.task_id}`
                                    )
                                }
                                className="flex-1"
                            >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                View Progress
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    activeImport?.task_id && handleCancelImport(activeImport.task_id)
                                }
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

    const handleFileDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault()
            setIsDragging(false)

            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0]
                if (file) {
                    handleFileUpload(file)
                }
            }
        },
        [handleFileUpload]
    )

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
            const file = e.target.files[0]
            if (file) {
                handleFileUpload(file)
            }
        }
    }

    const handleButtonClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click()
        }
    }

    return (
        <div className="flex flex-col h-full">
            <Header
                classAttributes="rounded-t-xl"
                breadcrumbItems={[
                    { href: "/import-opml", label: "OPML Import" },
                ]}
            />
            <main className="flex-1 px-4 py-6 md:px-6 overflow-hidden">
                <div className="max-w-4xl mx-auto">
                    <div className="mb-8">
                        <h1 className="text-2xl sm:text-3xl font-bold mb-3">
                            OPML Import
                        </h1>
                        <p className="text-muted-foreground leading-relaxed max-w-2xl">
                            Import feeds from an OPML file exported from another
                            RSS reader.
                        </p>
                    </div>

                    {/* Active Imports Section */}
                    {(activeImports.length > 0 || isLoadingActiveImports) && (
                        <div className="mb-8">{renderActiveImports()}</div>
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
                            <CardContent className="p-8 sm:p-12">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileInputChange}
                                    accept=".opml,.xml"
                                    className="hidden"
                                />
                                <div className="flex flex-col items-center justify-center gap-6 text-center">
                                    <div className="p-4 bg-muted rounded-full">
                                        <Upload
                                            size={48}
                                            className="text-muted-foreground"
                                        />
                                    </div>

                                    <div className="space-y-3 max-w-md">
                                        <h3 className="text-lg sm:text-xl font-medium">
                                            {isDragging
                                                ? "Drop your OPML file here"
                                                : "Upload OPML File"}
                                        </h3>
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            Drag and drop or click to select a
                                            .opml or .xml file from your RSS
                                            reader export
                                        </p>
                                    </div>

                                    <Button
                                        onClick={handleButtonClick}
                                        disabled={isUploading}
                                        size="lg"
                                        className="mt-2 w-full sm:w-auto"
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
                            <CardContent className="p-8 sm:p-12 text-center">
                                <div className="flex flex-col items-center justify-center gap-6">
                                    <div className="p-4 bg-gray-200 rounded-full">
                                        <Upload
                                            size={48}
                                            className="text-gray-400"
                                        />
                                    </div>
                                    <div className="space-y-3 max-w-md">
                                        <h3 className="text-lg font-medium text-gray-600">
                                            Upload Disabled
                                        </h3>
                                        <p className="text-sm text-gray-500 leading-relaxed">
                                            Complete or cancel your current
                                            import before starting a new one
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
