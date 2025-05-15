import { getEpubMetadata } from "@/lib/reader/bookstore"
import { createClient } from "@/lib/supabase/client"
import { NavItem } from "epubjs/types/navigation"
import { type PDFDocumentProxy } from "pdfjs-dist"
import { pdfjs } from "react-pdf"
import { BookMetadata, ProcessedFileMetadata } from "./types"

// Promise.withResolvers polyfill
if (typeof Promise.withResolvers === "undefined") {
    if (typeof window !== "undefined") {
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
}

export function cleanShallow(
    obj: { [s: string]: unknown } | ArrayLike<unknown>
) {
    return Object.fromEntries(
        Object.entries(obj).filter(([, v]) => v !== null && v !== "")
    )
}

export const renderFirstPageAsImage = async (
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
export function generateUniqueId(): string {
    return Math.random().toString(36).substr(2, 9)
}

/**
 * Given a PDF as a Uint8Array, this function extracts the PDF outline (table of contents)
 * and maps it into an array of NavItem objects.
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
            label: sanitizeText(item.title) || "Untitled",
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

export const extractPdfMetadata = async (
    file: File
): Promise<BookMetadata & { toc: NavItem[] }> => {
    const fileBuffer = await file.arrayBuffer()
    const pdfDocument = await pdfjs.getDocument(fileBuffer).promise
    const metadata = (await pdfDocument.getMetadata()) as {
        info: { Title?: string; Author?: string }
    }
    const toc = await getTableOfContents(pdfDocument)

    // Get metadata
    const imageUrl = await renderFirstPageAsImage(pdfDocument)

    return {
        title: metadata.info.Title || file.name.replace(/\.[^/.]+$/, ""),
        author: metadata.info.Author || "Unknown",
        description: "",
        coverUrl: imageUrl,
        total_pages: pdfDocument.numPages,
        toc,
    }
}

export const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

/**
 * Sanitizes text by removing null bytes and other problematic characters
 * that could cause database insertion issues.
 */
export const sanitizeText = (text: string | undefined | null): string => {
    if (!text) return ""
    // Remove null bytes and other control characters except common whitespace
    return text.replace(
        /[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g,
        ""
    )
}

/**
 * Recursively sanitizes all string values in an object or array
 * to remove null bytes and other problematic characters
 */
export const sanitizeJsonRecursively = (data: any): any => {
    if (data === null || data === undefined) {
        return data
    }

    if (typeof data === "string") {
        return sanitizeText(data)
    }

    if (Array.isArray(data)) {
        return data.map((item) => sanitizeJsonRecursively(item))
    }

    if (typeof data === "object") {
        const result: Record<string, any> = {}
        for (const key in data) {
            result[key] = sanitizeJsonRecursively(data[key])
        }
        return result
    }

    // Return as is for other types (number, boolean)
    return data
}

export const processFileMetadata = async (
    isPdf: boolean,
    file: File,
    fileBuffer: ArrayBuffer
): Promise<ProcessedFileMetadata> => {
    if (isPdf) {
        const metadata = await extractPdfMetadata(file)
        return {
            metadata: {
                title: sanitizeText(metadata.title),
                author: sanitizeText(metadata.author),
                description: sanitizeText(""),
                coverUrl: metadata.coverUrl,
                total_pages: metadata.total_pages,
                toc: sanitizeJsonRecursively(metadata.toc),
            },
            charCounts: [],
        }
    } else {
        // Handle EPUB metadata
        const epubMetadata = cleanShallow(await getEpubMetadata(fileBuffer))
        const { charCounts } = epubMetadata as { charCounts: number[] }
        const totalChars = charCounts.reduce((a, b) => a + b, 0)
        const estimatedPages = Math.ceil(totalChars / 2300) // ~2300 chars per page

        return {
            metadata: {
                title: sanitizeText(epubMetadata.title as string),
                author: sanitizeText(epubMetadata.creator as string),
                description: sanitizeText(epubMetadata.description as string),
                coverUrl: epubMetadata.coverUrl as string,
                total_pages: estimatedPages,
            },
            charCounts,
        }
    }
}

// Helper function to upload cover image to Supabase storage
export const uploadCoverImage = async (
    coverUrl: string | undefined,
    userId: string,
    bookId: string,
    supabase = createClient()
) => {
    if (!coverUrl) {
        return coverUrl || ""
    }

    const storagePath = `${userId}/${bookId}`

    try {
        // Convert data URL to blob
        const coverBlob = await fetch(coverUrl).then((res) => res.blob())

        // Upload to Supabase storage in the "images" bucket
        const { data, error: coverError } = await supabase.storage
            .from("images")
            .upload(storagePath, coverBlob, {
                contentType: "image/png",
                upsert: true,
            })

        if (coverError || !data) {
            console.error("Error uploading cover:", coverError)
            return coverUrl
        }
    } catch (error) {
        console.error("Error processing cover image:", error)
        return null
    }

    return storagePath
}
