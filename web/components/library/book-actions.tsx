import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "@/components/ui/sonner"
import { Json, TablesUpdate } from "@/database.types"
import { env } from "@/env"
import { getSession } from "@/lib/auth/supabase"
import { deleteBook, updateBook } from "@/lib/db/supabase"
import { deleteFileFromSupabase } from "@/lib/supabase/storage"
import { BookMeta } from "@/types/library"
import localforage from "localforage"
import { BookOpenCheck, MoreVertical, RotateCcw, Trash } from "lucide-react"
import { MouseEvent, useState } from "react"

interface BookActionsProps {
    book: BookMeta
}

export function BookActions({ book }: BookActionsProps) {
    const removeBook = async (e: MouseEvent<HTMLDivElement>) => {
        e.preventDefault()

        if (!book.id) {
            toast.error("Failed to delete book", "Could not determine book ID.")
            return
        }

        // Delete from Supabase database
        const success = await deleteBook(book.id)

        if (success) {
            // Remove from local storage
            localforage.removeItem(book.id)

            if (book.file_url !== "public/sample.pdf") {
                // Delete file from Supabase storage
                if (book.file_url) {
                    await deleteFileFromSupabase(book.file_url)
                }

                // Delete vectors from backend using book_id
                const session = await getSession()
                const headers: HeadersInit = {}

                if (session?.access_token) {
                    headers["Authorization"] = `Bearer ${session.access_token}`
                }

                if (book.rag_enabled) {
                    fetch(
                        `${env.NEXT_PUBLIC_API_BASE_URL}/vectors/${book.id}`,
                        {
                            method: "DELETE",
                            headers,
                            credentials: "include",
                            mode: "cors",
                        }
                    )
                }
            }
            toast.success(
                "Successfully deleted book",
                "The book has been removed from your library."
            )
        } else {
            toast.error(
                "Failed to delete book",
                "An error occurred while deleting the book."
            )
        }

        setIsOpen(false)
    }

    const resetProgress = async (e: MouseEvent<HTMLDivElement>) => {
        e.preventDefault()

        if (!book.id) {
            toast.error(
                "Failed to reset progress",
                "Could not determine book ID."
            )
            return
        }

        // Reset progress based on book type
        const updates: TablesUpdate<"books"> =
            book.type === "pdf"
                ? { pdf_page: 0 }
                : {
                      epub_progress: {
                          globalProgress: {
                              current: 0,
                              total:
                                  book.epub_progress?.globalProgress?.total ||
                                  0,
                          },
                      } as unknown as Json,
                  }

        const success = await updateBook(book.id, updates)

        if (success) {
            toast.success(
                "Successfully reset progress",
                "The progress for this book has been reset."
            )
        } else {
            toast.error(
                "Failed to reset progress",
                "An error occurred while resetting progress."
            )
        }

        setIsOpen(false)
    }

    const markComplete = async (e: MouseEvent<HTMLDivElement>) => {
        e.preventDefault()

        if (!book.id) {
            toast.error(
                "Failed to mark as complete",
                "Could not determine book ID."
            )
            return
        }

        // Mark as complete based on book type
        const updates: TablesUpdate<"books"> =
            book.type === "pdf"
                ? { pdf_page: book.num_pages || 0 }
                : {
                      epub_progress: {
                          globalProgress: {
                              current:
                                  book.epub_progress?.globalProgress?.total ||
                                  0,
                              total:
                                  book.epub_progress?.globalProgress?.total ||
                                  0,
                          },
                      } as unknown as Json,
                  }

        const success = await updateBook(book.id, updates)

        if (success) {
            toast.success(
                "Successfully marked as complete",
                "The book has been marked as complete."
            )
        } else {
            toast.error(
                "Failed to mark as complete",
                "An error occurred while marking the book as complete."
            )
        }

        setIsOpen(false)
    }

    const [isOpen, setIsOpen] = useState(false)

    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">More options</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={resetProgress}
                >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    <span>Reset progress</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={markComplete}
                >
                    <BookOpenCheck className="mr-2 h-4 w-4" />
                    <span>Mark as complete</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                    className="text-destructive cursor-pointer"
                    onClick={removeBook}
                >
                    <Trash className="mr-2 h-4 w-4" />
                    <span>Remove from Library</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
