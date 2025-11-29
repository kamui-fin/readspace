import { useImportOPML, parseOpml, ApiError } from "@readspace/shared"
import { useRouter } from "next/navigation"
import { useState, useCallback } from "react"
import { toast } from "react-hot-toast"

export function useOpmlImport() {
    const [file, setFile] = useState<File | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const uploadOpmlMutation = useImportOPML()
    const router = useRouter()

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

            uploadOpmlMutation.mutate(formData, {
                onSuccess: (data) => {
                    toast.success(
                        `Processing ${data.estimated_feeds} feeds. Import will run silently in background.`
                    )
                    router.push(`/import-opml/status/${data.task_id}`)
                },
                onError: (error) => {
                    console.error("Error uploading OPML file:", error)
                    if (error instanceof ApiError && error.status === 429) {
                        toast.error(error.message, { duration: 8000 })
                        return
                    }
                    if (error instanceof ApiError) {
                        toast.error(error.message)
                        return
                    }
                    toast.error("Failed to import OPML file. Please try again.")
                },
            })
        },
        [uploadOpmlMutation, router, validateOpmlFile]
    )

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFileUpload(e.target.files[0])
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileUpload(e.dataTransfer.files[0])
        }
    }

    return {
        isDragging,
        isLoading: uploadOpmlMutation.isPending,
        handleFileChange,
        handleDragOver,
        handleDragLeave,
        handleDrop,
    }
}
