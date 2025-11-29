"use client"


import Header from "@/components/features/navigation/Header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
    RSS_QUERY_KEYS,
    useActiveImportTask,
    useImportOPML,
    ApiError,
    parseOpml,
} from "@readspace/shared"
import { useQueryClient } from "@tanstack/react-query"
import { Clock, FileText, Upload } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "react-hot-toast"


export default function ImportOPMLPageClient() {
    const [isUploading, setIsUploading] = useState(false)
    const [isDragging, setIsDragging] = useState(false)

    const fileInputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()
    const queryClient = useQueryClient()

    // Use the hook for active imports
    const { data: activeTask } = useActiveImportTask()
    const activeImports = useMemo(
        () => (activeTask ? [activeTask] : []),
        [activeTask]
    )

    // Poll for status updates if we have active imports
    useEffect(() => {
        if (activeImports.length > 0) {
            const interval = setInterval(() => {
                // Invalidate query to trigger refetch
                queryClient.invalidateQueries({
                    queryKey: [RSS_QUERY_KEYS.OPML_IMPORT_TASKS],
                })
            }, 2000)

            return () => clearInterval(interval)
        }
    }, [activeImports.length, queryClient])

    // Use the hook for import mutation
    const importOpml = useImportOPML({
        onSuccess: (data) => {
            // Redirect to the status page immediately
            router.push(`/import-opml/status/${data.task_id}`)

            // Show success message
            toast.success(
                `Processing ${data.estimated_feeds} feeds. Import will run silently in background.`
            )

            // Invalidate tasks query
            queryClient.invalidateQueries({
                queryKey: [RSS_QUERY_KEYS.OPML_IMPORT_TASKS],
            })
        },
        onError: (error) => {
            console.error("Error uploading OPML file:", error)

            // Handle resource limit errors (429) with user-friendly message
            if (error instanceof ApiError && error.status === 429) {
                toast.error(error.message, { duration: 8000 })
                return
            }

            // Handle other API errors with their specific messages
            if (error instanceof ApiError) {
                toast.error(error.message)
                return
            }

            // Generic error handling for unknown errors
            toast.error("Failed to import OPML file. Please try again.")
        },
        onSettled: () => {
            setIsUploading(false)
        },
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

                const parsedOpml = parseOpml(content)

                if (!parsedOpml || !parsedOpml.body) {
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

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const countFeeds = (outlines: Array<{ xmlUrl?: string; outlines?: any[] }>, level = 0) => {
                    if (level > 1) {
                        hasNestedCategories = true
                    }

                    for (const outline of outlines || []) {
                        if (outline.xmlUrl) {
                            if (!existingUrls.has(outline.xmlUrl)) {
                                feedCount++
                                existingUrls.add(outline.xmlUrl)
                            }
                        } else if (outline.outlines) {
                            countFeeds(outline.outlines, level + 1)
                        }
                    }
                }

                countFeeds(parsedOpml.body.outlines ?? [])

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
            if (activeImports && activeImports.length > 0) {
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
            importOpml.mutate(formData)
        },
        [activeImports, validateOpmlFile, importOpml]
    )

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
                            {activeImports && activeImports.length > 0
                                ? "Import Began"
                                : "OPML Import"}
                        </h1>
                        <p className="text-muted-foreground leading-relaxed max-w-2xl">
                            {activeImports && activeImports.length > 0
                                ? "Your OPML import is currently running. Check the progress below."
                                : "Import feeds from an OPML file exported from another RSS reader."}
                        </p>
                    </div>

                    {/* Show active import status or upload section */}
                    {activeImports &&
                        activeImports.length > 0 &&
                        activeImports[0] ? (
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Clock className="h-5 w-5 text-blue-600 animate-pulse" />
                                        <div>
                                            <div className="font-medium">
                                                {activeImports[0].filename}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                {
                                                    activeImports[0]
                                                        .estimated_feeds
                                                }{" "}
                                                feeds
                                            </div>
                                        </div>
                                    </div>
                                    <Button asChild>
                                        <a
                                            href={`/import-opml/status/${activeImports[0].task_id}`}
                                        >
                                            View Progress
                                        </a>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card
                            className={`transition-colors duration-200 ${isDragging
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
                </div>
            </main>
        </div>
    )
}
