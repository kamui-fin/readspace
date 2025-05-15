"use server"

import { TablesInsert, TablesUpdate } from "@/database.types"
import { db } from "@/lib/db/drizzle"
import { users } from "@/lib/db/schema"
import { createClient } from "@/lib/supabase/server"
import { eq } from "drizzle-orm"
import { ScaledPosition } from "react-pdf-highlighter-extended"
import {
    BookMeta,
    EpubHighlight,
    PdfHighlight,
    SerializedRange,
} from "../../../../types/library"

export const getUserRoleFromId = async (userId?: string) => {
    const userProfile = await db.query.users.findFirst({
        where: eq(users.id, userId || ""),
    })

    return userProfile?.role
}

// Add a new highlight (works for both PDF and EPUB)
export const addHighlight = async (highlight: TablesInsert<"highlights">) => {
    const supabase = await createClient()
    const { error } = await supabase.from("highlights").insert(highlight)

    return !error
}

// Get all highlights for a book
export const getHighlights = async (
    bookId: string,
    bookType: "epub" | "pdf"
): Promise<(EpubHighlight | PdfHighlight)[]> => {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from("highlights")
        .select("*")
        .eq("book_id", bookId)

    if (error) {
        console.error("Error fetching highlights:", error)
        return []
    }

    if (bookType === "epub") {
        return data.map(
            ({
                book_id,
                color,
                text,
                note,
                epub_range,
                epub_chapter_href,
                epub_chapter_idx,
                epub_chapter_title,
                epub_est_page,
            }) =>
                ({
                    book_id,
                    color,
                    text,
                    note,
                    range: epub_range as unknown as SerializedRange,
                    chapter: {
                        href: epub_chapter_href,
                        idx: epub_chapter_idx,
                        title: epub_chapter_title,
                    },
                    page: epub_est_page,
                }) as EpubHighlight
        )
    } else {
        return data.map(
            ({ id, book_id, color, text, note, pdf_rect_position }) => {
                return {
                    id,
                    book_id,
                    color,
                    note,
                    type: "text",
                    position: pdf_rect_position as unknown as ScaledPosition,
                    content: {
                        text,
                    },
                } as PdfHighlight
            }
        )
    }
}

// Delete highlights by text
export const deleteHighlightsByText = async (text: string) => {
    const supabase = await createClient()
    const { error } = await supabase
        .from("highlights")
        .delete()
        .eq("text", text)

    return !error
}

// Add annotation
export const addAnnotation = async (note: string, text: string) => {
    const supabase = await createClient()
    const { error } = await supabase
        .from("highlights")
        .update({ note })
        .eq("text", text)

    return !error
}

// Save PDF progress
export const savePdfProgress = async (page: number, bookId: string) => {
    const supabase = await createClient()
    const { error } = await supabase
        .from("books")
        .update({ pdf_page: page })
        .eq("id", bookId)

    return !error
}

// Save EPUB progress
export const saveEpubProgress = async (
    progress: TablesUpdate<"books">["epub_progress"],
    bookId: string
) => {
    console.log("Saving EPUB progress to database:", progress, bookId)
    const supabase = await createClient()
    const { error, status, statusText, data } = await supabase
        .from("books")
        .update({ epub_progress: progress })
        .eq("id", bookId)

    console.log("Status:", status)
    console.log("Status Text:", statusText)
    console.log("Error:", error)
    console.log("Data:", data)
    return !error
}

// Get all books
export const getAllBooks = async () => {
    const supabase = await createClient()
    const { data, error } = await supabase.from("books").select("*")

    if (error) {
        console.error("Error fetching books:", error)
        return []
    }

    return data as BookMeta[]
}

// Get single book
export const getBook = async (id: string) => {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from("books")
        .select("*")
        .eq("id", id)
        .single()

    if (error) {
        console.error("Error fetching book:", error)
        return null
    }

    return data as BookMeta
}

// Create book
export const createBook = async (book: TablesInsert<"books">) => {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from("books")
        .insert(book)
        .select()
        .single()

    if (error) {
        console.error("Error creating book:", error)
        return null
    }

    return data as BookMeta
}

// Process the book once retrieved
export async function processBook(book: BookMeta) {
    // No need to handle local progress here as it will be handled client-side
    return { ...book }
}

/**
 * Updates the last page number included in an active recall session for a specific book.
 *
 * @param bookId The UUID of the book to update.
 * @param lastPage The page number that was the end of the recalled range.
 * @returns True if the update was successful, false otherwise.
 */
export const updateLastRecallPage = async (
    bookId: string,
    lastPage: number
): Promise<boolean> => {
    console.log(`Updating last_recall_page for book ${bookId} to ${lastPage}`)
    const supabase = await createClient()
    const { error } = await supabase
        .from("books")
        .update({ last_recall_page: lastPage })
        .eq("id", bookId)

    if (error) {
        console.error(
            `Error updating last_recall_page for book ${bookId}:`,
            error
        )
        return false
    }

    // Optionally revalidate the path if the book data is displayed elsewhere
    // and needs to be refreshed immediately after this update.
    // revalidatePath(`/library/${bookId}`) // Or relevant path
    // revalidatePath(`/library`) // If book list shows this info

    console.log(`Successfully updated last_recall_page for book ${bookId}`)
    return true
}

/**
 * Updates the language of a book.
 *
 * @param bookId The UUID of the book to update.
 * @param language The language code to set for the book.
 * @returns True if the update was successful, false otherwise.
 */
export const updateBookLanguage = async (
    bookId: string,
    language: string
): Promise<boolean> => {
    console.log(`Updating language for book ${bookId} to ${language}`)
    const supabase = await createClient()
    const { error } = await supabase
        .from("books")
        .update({ language })
        .eq("id", bookId)

    if (error) {
        console.error(`Error updating language for book ${bookId}:`, error)
        return false
    }

    console.log(`Successfully updated language for book ${bookId}`)
    return true
}
