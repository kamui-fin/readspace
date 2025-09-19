import { ApiWebClient } from "@/lib/api-client"
import { cacheBook } from "@/lib/reader/bookstore"
import { createClient } from "@/lib/supabase/client"
import { UserBookLibrary } from "@/types/api"
import { User } from "@supabase/supabase-js"
import { useMutation } from "@tanstack/react-query"
import { toast } from "react-hot-toast"
import { BookMetadata as UploadBookMetadata, UploadResponse } from "./types"
import {
    sanitizeJsonRecursively,
    sanitizeText,
    uploadCoverImage,
} from "./utils"

// Helper function to upload file to cloud storage
export const uploadToCloudStorage = async (file: File, bookId: string) => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("book_id", bookId)

    return ApiWebClient.uploadFile(
        "/api/upload/",
        formData
    ) as Promise<UploadResponse>
}

export const useUploadBook = () => {
    return useMutation({
        mutationFn: async ({
            file,
            user,
            metadata,
            charCounts,
        }: {
            file: File
            user: User
            metadata: UploadBookMetadata
            charCounts: number[]
        }) => {
            try {
                const fileBuffer = await file.arrayBuffer()
                const isPdf = file.type === "application/pdf"

                // First create the book metadata (without cover_url initially)
                const bookMetadata = {
                    title: sanitizeText(metadata.title) || "Untitled",
                    author: sanitizeText(metadata.author) || "Unknown Author",
                    description: sanitizeText(metadata.description) || "",
                    cover_url: null, // Will be set after cover upload
                    format: isPdf ? "PDF" : "EPUB",
                    file_url: "", // Will be set after file upload
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

                const createdMetadata = await ApiWebClient.post<{ id: string }>(
                    "/api/books/metadata",
                    bookMetadata
                )

                // Upload cover image to Supabase storage using the metadata ID
                const coverUrl = await uploadCoverImage(
                    metadata.coverUrl,
                    user.id,
                    createdMetadata.id,
                    createClient()
                )

                // Update metadata with cover_url if upload was successful
                if (coverUrl && coverUrl !== metadata.coverUrl) {
                    await ApiWebClient.put(
                        `/api/books/metadata/${createdMetadata.id}`,
                        {
                            cover_url: coverUrl,
                        }
                    )
                }

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

                const libraryResult = await ApiWebClient.post<UserBookLibrary>(
                    "/api/books/",
                    libraryData
                )

                // Always cache the book in localforage for performance
                await cacheBook(fileBuffer, createdMetadata.id)

                // Upload to Cloud Storage
                const uploadResponse = await uploadToCloudStorage(
                    file,
                    libraryResult.id
                )

                // Update the book metadata with the file URL
                await ApiWebClient.put(
                    `/api/books/metadata/${createdMetadata.id}`,
                    {
                        file_url: uploadResponse.file_path,
                    }
                )

                toast.success("Book added")

                return { bookId: libraryResult.id, library: libraryResult }
            } catch (error) {
                console.error("Error uploading book:", error)
                throw error
            }
        },
    })
}
