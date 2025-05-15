"use client"

import { TablesUpdate } from "@/database.types"
import { EpubLocation } from "@/types/library"
import ePub, { Book } from "epubjs"
import { SpineItem } from "epubjs/types/section"
import localforage from "localforage"
import { stripHtml } from "string-strip-html"
import { stripMetaBaseLinkTags } from "./reader-utils"

export const getEpubMetadata = async (fileBuffer: ArrayBuffer) => {
    const epub = ePub(fileBuffer)
    await epub.ready

    const metadata = await epub.loaded.metadata
    // hack for now
    metadata.language = "English (en)"

    const cover = await epub.loaded.cover
    const spine = await epub.loaded.spine

    const description = stripHtml(metadata.description).result

    const charCounts = await getChapterCharCounts(epub)

    let coverUrl = null

    if (cover) {
        coverUrl = await epub.archive.createUrl(cover, {
            base64: true,
        })
    }

    // Get spine order (reading order) of chapters
    // @ts-expect-error "spineItems is not typed"
    const spineOrder = spine.spineItems
        .map((item: SpineItem) => item.href)
        .filter(
            (href: string | undefined): href is string => href !== undefined
        )

    return {
        ...metadata,
        coverUrl,
        description,
        spineOrder,
        charCounts,
    }
}

/**
 * Iterates through an epub's spine, and
 * returns an array mapping each chapter index to its total character count.
 *
 * @param epubUrl - The URL of the EPUB file.
 * @returns A Promise that resolves to an array of character counts.
 */
async function getChapterCharCounts(book: Book): Promise<number[]> {
    // The spine holds the chapters (each spine item represents a chapter)
    const spineItems: SpineItem[] = await book.loaded.spine // Array of spine items
    const chapterCharCounts: number[] = []

    // Iterate through each spine item (chapter)
    for (let i = 0; i < spineItems.length; i++) {
        // @ts-expect-error "spineItems is not typed"
        const item = spineItems.get(i)

        console.log("item", item)

        // Load chapter content as a string; item.load() returns a promise.
        const content = stripMetaBaseLinkTags(
            await item.render(book.load.bind(book))
        )

        // Convert the HTML string to a Document to extract plain text.
        // Using DOMParser (available in browsers) to strip HTML tags.
        const parser = new DOMParser()
        const doc = parser.parseFromString(content, "text/html")
        const textContent = cleanText(doc.body.textContent || "")

        // Count the characters in the text (all characters are counted)
        const charCount = textContent.length
        chapterCharCounts.push(charCount)
    }

    return chapterCharCounts
}

export const cleanText = (text: string): string => {
    return text.replace(/\s+/g, " ").trim()
}

export const cacheBook = async (fileBuffer: ArrayBuffer, bookId: string) => {
    localforage.setItem(bookId, fileBuffer)
}

export const getEpubFromCache = async (bookId: string) => {
    return localforage.getItem<ArrayBuffer>(bookId)
}

// Local book progress storage keys
const PDF_PROGRESS_PREFIX = "pdf-progress-"
const EPUB_PROGRESS_PREFIX = "epub-progress-"

/**
 * Initializes book storage for a new book, ensuring we have the necessary
 * entries in localforage for storing progress
 */
export async function initializeBookProgressStorage(
    bookId: string,
    bookType: string
): Promise<void> {
    try {
        if (bookType === "epub") {
            // Check if we already have progress stored
            const existingProgress = await getLocalEpubProgress(bookId)
            if (!existingProgress) {
                // Initialize with empty progress
                await saveLocalEpubProgress(
                    {
                        loc: "",
                        scrollElement: undefined,
                        globalProgress: {
                            current: 0,
                            total: 0,
                        },
                    },
                    bookId
                )
            }
        } else if (bookType === "pdf") {
            const existingProgress = await getLocalPdfProgress(bookId)
            if (existingProgress === null) {
                // Initialize with page 1
                await saveLocalPdfProgress(1, bookId)
            }
        }
    } catch (error) {
        console.error("Error initializing book progress storage:", error)
    }
}

/**
 * Saves EPUB reading progress to localforage
 */
export async function saveLocalEpubProgress(
    progress: TablesUpdate<"books">["epub_progress"],
    bookId: string
): Promise<boolean> {
    try {
        await localforage.setItem(`${EPUB_PROGRESS_PREFIX}${bookId}`, progress)
        return true
    } catch (error) {
        console.error("Error saving local EPUB progress:", error)
        return false
    }
}

/**
 * Retrieves EPUB reading progress from localforage
 */
export async function getLocalEpubProgress(
    bookId: string
): Promise<EpubLocation | null> {
    try {
        return await localforage.getItem(`${EPUB_PROGRESS_PREFIX}${bookId}`)
    } catch (error) {
        console.error("Error retrieving local EPUB progress:", error)
        return null
    }
}

/**
 * Saves PDF reading progress to localforage
 */
export async function saveLocalPdfProgress(
    page: number,
    bookId: string
): Promise<boolean> {
    try {
        await localforage.setItem(`${PDF_PROGRESS_PREFIX}${bookId}`, page)
        return true
    } catch (error) {
        console.error("Error saving local PDF progress:", error)
        return false
    }
}

/**
 * Retrieves PDF reading progress from localforage
 */
export async function getLocalPdfProgress(
    bookId: string
): Promise<number | null> {
    try {
        return await localforage.getItem(`${PDF_PROGRESS_PREFIX}${bookId}`)
    } catch (error) {
        console.error("Error retrieving local PDF progress:", error)
        return null
    }
}
