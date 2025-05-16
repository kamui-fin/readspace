"use client"

export { UploadBookDialog as default } from "./upload/index"

// Initialize PDF Worker for PDF.js (needs to be done at module level)
import { pdfjs } from "react-pdf"
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url
).toString()

import { Checkbox } from "@/components/ui/checkbox"
import {
    FileList,
    FileListAction,
    FileListActions,
    FileListDescription,
    FileListDescriptionSeparator,
    FileListDescriptionText,
    FileListHeader,
    FileListIcon,
    FileListInfo,
    FileListItem,
    FileListName,
    FileListSize,
} from "@/components/ui/file-list"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { User } from "@supabase/supabase-js"
import { BookOpen, LoaderCircle, X } from "lucide-react"
import { type PDFDocumentProxy } from "pdfjs-dist"
import { useCallback, useId } from "react"
import { useDropzone } from "react-dropzone"
import { Card } from "../ui/card"

if (typeof Promise.withResolvers === "undefined") {
    if (window)
        // @ts-expect-error This does not exist outside of polyfill which this is doing
        window.Promise.withResolvers = function () {
            let resolve, reject
            const promise = new Promise((res, rej) => {
                resolve = res
                reject = rej
            })
            return { promise, resolve, reject }
        }
}

import { NavItem } from "epubjs/types/navigation"

function cleanShallow(obj: { [s: string]: unknown } | ArrayLike<unknown>) {
    return Object.fromEntries(
        Object.entries(obj).filter(([, v]) => v !== null && v !== "")
    )
}

interface PdfMetadata {
    info: {
        Title?: string
        Author?: string
    }
}

interface BookProgress {
    globalProgress: {
        current: number
        total: number
    }
}

const renderFirstPageAsImage = async (
    pdfDocument: PDFDocumentProxy
): Promise<string> => {
    try {
        // Get the first page (pages are 1-indexed)
        const page = await pdfDocument.getPage(1)

        // Set the scale and viewport
        const scale = 1.5
        const viewport = page.getViewport({ scale })

        // Create canvas with integer dimensions
        const canvas = document.createElement("canvas")
        const context = canvas.getContext("2d", { alpha: false })

        // Ensure dimensions are integers to prevent anti-aliasing
        canvas.height = Math.ceil(viewport.height)
        canvas.width = Math.ceil(viewport.width)

        if (!context) return ""

        // Render the page
        const renderContext = {
            canvasContext: context,
            viewport,
        }

        await page.render(renderContext).promise

        return canvas.toDataURL("image/png")
    } catch (error) {
        console.error("Error rendering page:", error)
        return ""
    }
}

// A simple utility function to generate unique IDs for each nav item.
function generateUniqueId(): string {
    return Math.random().toString(36).substr(2, 9)
}

/**
 * Given a PDF as a Uint8Array, this function extracts the PDF outline (table of contents)
 * and maps it into an array of NavItem objects.
 *
 * @param pdfData - The PDF data as a Uint8Array.
 * @returns A Promise that resolves to an array of NavItem objects.
 */
export async function getTableOfContents(
    pdf: PDFDocumentProxy
): Promise<NavItem[]> {
    // Retrieve the outline which contains the table of contents.
    const outline = await pdf.getOutline()
    if (!outline) {
        // If no outline is available in the PDF, return an empty array.
        return []
    }

    // A helper function to process an individual outline item (and its subitems if any) recursively.
    const processOutlineItem = async (item: any): Promise<NavItem | null> => {
        let pageNumber = "1"
        let ref: any
        try {
            // Check if item.dest[0] is already a page reference object
            if (
                item.dest[0] &&
                typeof item.dest[0] === "object" &&
                "num" in item.dest[0]
            ) {
                ref = item.dest[0]
            } else {
                // If not, get the destination and page index
                const dest = await pdf.getDestination(item.dest)
                if (!dest) {
                    return null
                }
                ref = dest[0]
            }

            const page = await pdf.getPageIndex(ref)
            pageNumber = (page + 1).toString()
        } catch (error) {
            console.log(item)
            return null
        }

        const navItem: NavItem = {
            id: generateUniqueId(),
            label: item.title || "Untitled",
            href: pageNumber,
        }

        // If the item has subitems, process them recursively.
        if (item.items && item.items.length > 0) {
            navItem.subitems = await Promise.all(
                item.items
                    .map(processOutlineItem)
                    .filter(
                        (elm: NavItem | null): elm is NavItem => elm !== null
                    )
            )
        }

        return navItem
    }
    // Process all the top-level outline items.
    const navItems = (
        await Promise.all(outline.map(processOutlineItem))
    ).filter((elm): elm is NavItem => elm !== null)
    console.log(navItems)
    return navItems
}

const extractPdfMetadata = async (file: File) => {
    const fileBuffer = await file.arrayBuffer()
    const pdfDocument = await pdfjs.getDocument(fileBuffer).promise
    const metadata = (await pdfDocument.getMetadata()) as {
        info: PdfMetadata["info"]
    }
    const toc = await getTableOfContents(pdfDocument)

    // Get metadata
    const imageUrl = await renderFirstPageAsImage(pdfDocument)

    return {
        title: metadata.info.Title || file.name.replace(/\.[^/.]+$/, ""),
        author: metadata.info.Author || "Unknown",
        progress: 0,
        total_pages: pdfDocument.numPages,
        coverUrl: imageUrl,
        toc,
    }
}

const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

export const DragDropBook = ({
    isUploading,
    onFileSelect,
    selectedFile,
    onRemoveFile,
    user,
    isLocalStorage,
    setIsLocalStorage,
}: {
    isUploading: boolean
    onFileSelect: (file: File | null) => void
    selectedFile: File | null
    onRemoveFile: () => void
    user: User | null
    isLocalStorage: boolean
    setIsLocalStorage: (value: boolean) => void
}) => {
    const localStorageId = useId()

    const onDrop = useCallback(
        async (acceptedFiles: File[]) => {
            const file = acceptedFiles[0]
            if (!file || !user) return
            onFileSelect(file)
        },
        [user, onFileSelect]
    )

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            "application/epub+zip": [".epub"],
            "application/pdf": [".pdf"],
        },
        multiple: false,
    })

    return (
        <div className="w-full space-y-4">
            {selectedFile ? (
                <>
                    <FileList className="pb-8">
                        <FileListItem>
                            <FileListHeader>
                                <FileListIcon>
                                    <BookOpen className="h-4 w-4" />
                                </FileListIcon>
                                <FileListInfo>
                                    <FileListName className="truncate max-w-[200px]">
                                        {selectedFile.name}
                                    </FileListName>
                                    <FileListDescription>
                                        <FileListSize>
                                            {formatFileSize(selectedFile.size)}
                                        </FileListSize>
                                        <FileListDescriptionSeparator>
                                            •
                                        </FileListDescriptionSeparator>
                                        <FileListDescriptionText>
                                            {selectedFile.type ===
                                            "application/pdf"
                                                ? "PDF"
                                                : "EPUB"}
                                        </FileListDescriptionText>
                                    </FileListDescription>
                                </FileListInfo>
                                <FileListActions>
                                    <FileListAction onClick={onRemoveFile}>
                                        <X className="h-4 w-4" />
                                        <span className="sr-only">Remove</span>
                                    </FileListAction>
                                </FileListActions>
                            </FileListHeader>
                        </FileListItem>
                    </FileList>
                </>
            ) : (
                <Card
                    {...getRootProps()}
                    className={cn(
                        "p-12 border-2 border-dashed cursor-pointer transition-colors",
                        isDragActive
                            ? "border-primary bg-primary/5"
                            : "border-muted-foreground/25"
                    )}
                >
                    <input {...getInputProps()} />
                    <div className="flex flex-col items-center gap-4 text-center">
                        {isUploading ? (
                            <div className="flex flex-row items-center gap-2">
                                <LoaderCircle className="animate-spin text-muted-foreground" />
                                <p className="text-sm text-muted-foreground mt-1">
                                    Uploading...
                                </p>
                            </div>
                        ) : (
                            <>
                                <BookOpen className="w-12 h-12 text-muted-foreground" />
                                <div>
                                    <p className="text-xl font-medium">
                                        Drop your epub or pdf here
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        or click to select
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                </Card>
            )}
            <div className="flex items-start gap-2">
                <Checkbox
                    id={localStorageId}
                    checked={isLocalStorage}
                    onCheckedChange={setIsLocalStorage}
                    aria-describedby={`${localStorageId}-description`}
                />
                <div className="grid grow gap-2">
                    <Label htmlFor={localStorageId}>Store locally only</Label>
                    <p
                        id={`${localStorageId}-description`}
                        className="text-muted-foreground text-xs"
                    >
                        Store only on this device
                    </p>
                </div>
            </div>
        </div>
    )
}
