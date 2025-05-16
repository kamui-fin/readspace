import { Json } from "@/database.types"
import { env } from "@/env"
import { useCreateBook, useUpdateBook } from "@/lib/api/hooks/books"
import { getSession } from "@/lib/auth/supabase"
import { cacheBook } from "@/lib/reader/bookstore"
import { createClient } from "@/lib/supabase/client"
import { BookCreate } from "@/types/api"
import { User } from "@supabase/supabase-js"
import { useMutation } from "@tanstack/react-query"
import { toast } from "react-hot-toast"
import { BookMetadata } from "./types"
import {
    sanitizeJsonRecursively,
    sanitizeText,
    uploadCoverImage,
} from "./utils"

// Helper function to upload file to cloud storage
export const uploadToCloudStorage = async (
    file: File,
    bookId: string,
    enableRag: boolean,
    estimatedPages: number
) => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("process_rag", String(enableRag))
    formData.append("book_id", bookId)
    formData.append("estimated_pages", String(estimatedPages))

    const session = await getSession()
    const headers: HeadersInit = {}

    if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`
    }

    const response = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}/upload/`, {
        method: "POST",
        headers,
        body: formData,
        credentials: "include",
        mode: "cors",
    })

    if (!response.ok) {
        throw new Error(
            `${file.type.includes("pdf") ? "PDF" : "EPUB"} upload failed`
        )
    }

    const result = await response.json()
    return result.file_path
}

export const useUpdateBookGoals = () => {
    const updateBookMutation = useUpdateBook()

    return async (bookId: string, goals: string) => {
        try {
            await updateBookMutation.mutateAsync({
                bookId,
                book: { goals: sanitizeText(goals.trim()) || null },
            })
        } catch (error) {
            console.error("Error updating book goals:", error)
            throw new Error("Failed to update book goals")
        }
    }
}

export const useUploadBook = () => {
    const createBookMutation = useCreateBook()

    return useMutation({
        mutationFn: async ({
            file,
            user,
            isLocalStorage,
            metadata,
            charCounts,
            enableRag = true,
        }: {
            file: File
            user: User
            isLocalStorage: boolean
            metadata: BookMetadata
            charCounts: number[]
            enableRag?: boolean
        }) => {
            // Generate a unique book ID
            const bookId = crypto.randomUUID()

            try {
                const fileBuffer = await file.arrayBuffer()
                const isPdf = file.type === "application/pdf"
                const estimatedPages = metadata.total_pages || 1

                // Upload cover image to Supabase storage
                const coverUrl = await uploadCoverImage(
                    metadata.coverUrl,
                    user.id,
                    bookId,
                    createClient()
                )

                // Always cache the book in localforage
                await cacheBook(fileBuffer, bookId)

                // Create progress object for EPUB
                const progress = !isPdf
                    ? {
                          globalProgress: {
                              current: 0,
                              total: charCounts.reduce((a, b) => a + b, 0),
                          },
                      }
                    : undefined

                let bookData: BookCreate = {
                    user_id: user.id,
                    title: sanitizeText(metadata.title) || "Untitled",
                    author: sanitizeText(metadata.author) || "Unknown Author",
                    description: sanitizeText(metadata.description) || "",
                    cover_url: coverUrl,
                    file_type: isPdf ? "pdf" : "epub",
                    file_url: null, // Will be set based on storage type
                    total_pages: metadata.total_pages,
                    goals: null, // Goals will be added in a separate step
                    ...(isPdf
                        ? {
                              pdf_page: 0,
                              pdf_toc: sanitizeJsonRecursively(
                                  metadata.toc
                              ) as unknown as Json,
                          }
                        : {
                              epub_progress: sanitizeJsonRecursively(
                                  progress
                              ) as unknown as Record<string, unknown>,
                              epub_chapter_char_counts: charCounts,
                          }),
                }

                if (isLocalStorage) {
                    // Add book to database with file_url set to null for local storage
                    bookData = {
                        ...bookData,
                        file_url: null, // Indicates local storage
                        rag_enabled: false, // Local storage books don't use RAG
                    }
                    const book = await createBookMutation.mutateAsync(bookData)
                    if (!book) {
                        throw new Error(
                            "Failed to create book in database for local storage"
                        )
                    }
                    toast.success("Book saved locally successfully")
                } else {
                    // Upload to Cloud Storage
                    const filePath = await uploadToCloudStorage(
                        file,
                        bookId,
                        enableRag,
                        estimatedPages
                    )

                    // Add book to database with file_url from cloud storage
                    bookData = {
                        ...bookData,
                        file_url: filePath,
                        rag_enabled: enableRag,
                    }
                    const book = await createBookMutation.mutateAsync(bookData)

                    if (!book) {
                        throw new Error(
                            "Failed to create book in database after cloud upload"
                        )
                    }

                    toast.success("Book uploaded successfully")
                }

                return { bookId, bookData }
            } catch (error) {
                console.error("Error uploading book:", error)
                throw error
            }
        },
    })
}
