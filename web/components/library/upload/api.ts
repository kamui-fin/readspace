import { ApiClient } from "@/lib/api/client"
import { cacheBook } from "@/lib/reader/bookstore"
import { createClient } from "@/lib/supabase/client"
import { UserBookLibrary } from "@/types/api"
import { User } from "@supabase/supabase-js"
import { useMutation } from "@tanstack/react-query"
import { toast } from "react-hot-toast"
import { BookMetadata as UploadBookMetadata } from "./types"
import {
    sanitizeJsonRecursively,
    sanitizeText,
    uploadCoverImage,
} from "./utils"

// Helper function to upload file to cloud storage
export const uploadToCloudStorage = async (
    file: File,
    bookId: string,
) => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("book_id", bookId)

    return ApiClient.uploadFile("/upload/", formData)
}

export const useUploadBook = () => {
    return useMutation({
        mutationFn: async ({
            file,
            user,
            isLocalStorage,
            metadata,
            charCounts,
        }: {
            file: File
            user: User
            isLocalStorage: boolean
            metadata: UploadBookMetadata
            charCounts: number[]
        }) => {
            try {
                const fileBuffer = await file.arrayBuffer()
                const isPdf = file.type === "application/pdf"

                // Upload cover image to Supabase storage
                const coverUrl = await uploadCoverImage(
                    metadata.coverUrl,
                    user.id,
                    metadata.title,
                    createClient()
                )

                // First create the book metadata
                const bookMetadata = {
                    title: sanitizeText(metadata.title) || "Untitled",
                    author: sanitizeText(metadata.author) || "Unknown Author",
                    description: sanitizeText(metadata.description) || "",
                    cover_url: coverUrl,
                    format: isPdf ? "PDF" : "EPUB",
                    file_url: null, // Will be set based on storage type
                    file_size_bytes: file.size,
                    num_pages: metadata.total_pages,
                    ...(isPdf
                        ? {
                            pdf_toc: sanitizeJsonRecursively(
                                metadata.toc
                            ) as Record<string, unknown>,
                        }
                        : {
                            epub_chapter_char_counts: charCounts,
                        }),
                }

                const createdMetadata = await ApiClient.post<{ id: string }>("/api/books/metadata", bookMetadata)

                // Create progress object for EPUB
                const progress = !isPdf
                    ? {
                        globalProgress: {
                            current: 0,
                            total: charCounts.reduce((a, b) => a + b, 0),
                        },
                    }
                    : undefined

                // Add book to user's library
                const libraryData = {
                    user_id: user.id,
                    book_metadata_id: createdMetadata.id,
                    ...(isPdf
                        ? {
                            pdf_current_page: 0,
                        }
                        : {
                            epub_progress: progress,
                        }),
                }

                const libraryResult = await ApiClient.post<UserBookLibrary>("/books", libraryData)

                // Always cache the book in localforage
                await cacheBook(fileBuffer, createdMetadata.id)

                if (isLocalStorage) {
                    toast.success("Book saved locally successfully")
                } else {
                    // Upload to Cloud Storage
                    const uploadResponse = await uploadToCloudStorage(
                        file,
                        libraryResult.id,
                    )

                    // Update the book metadata with the file URL
                    await ApiClient.put(`/api/books/metadata/${createdMetadata.id}`, {
                        file_url: uploadResponse.file_path,
                    })

                    toast.success("Book uploaded successfully")
                }

                return { bookId: libraryResult.id, library: libraryResult }
            } catch (error) {
                console.error("Error uploading book:", error)
                throw error
            }
        },
    })
}
