import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useDeleteBook, useUpdateBook } from "@/lib/api/hooks/books"
import { getSession } from "@/lib/auth/supabase"
import { deleteFileFromSupabase } from "@/lib/supabase/storage"
import { BookUpdate } from "@/types/api"
import { BookMeta } from "@/types/library"
import localforage from "localforage"
import { BookOpenCheck, MoreVertical, RotateCcw, Trash } from "lucide-react"
import { MouseEvent, useState } from "react"
import toast from "react-hot-toast"

interface BookActionsProps {
    book: BookMeta
}

export function BookActions({ book }: BookActionsProps) {
    const [isOpen, setIsOpen] = useState(false)
    const deleteBookMutation = useDeleteBook()
    const updateBookMutation = useUpdateBook()

    const removeBook = async (e: MouseEvent<HTMLDivElement>) => {
        e.preventDefault()

        if (!book.id) {
            toast.error("Failed to delete book - Could not determine book ID.")
            return
        }

        try {
            // Delete from database
            await deleteBookMutation.mutateAsync(book.id)

            // Remove from local storage
            localforage.removeItem(book.id)

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
            toast.success("Successfully deleted book - The book has been removed from your library.")
        } catch (error) {
            toast.error("Failed to delete book - An error occurred while deleting the book.")
        }

        setIsOpen(false)
    }

    const resetProgress = async (e: MouseEvent<HTMLDivElement>) => {
        e.preventDefault()

        if (!book.id) {
            toast.error("Failed to reset progress - Could not determine book ID.")
            return
        }

        try {
            // Reset progress based on book type
            const updates: BookUpdate =
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
                        },
                    }

            await updateBookMutation.mutateAsync({ bookId: book.id, book: updates })
            toast.success("Successfully reset progress - The progress for this book has been reset.")
        } catch (error) {
            toast.error("Failed to reset progress - An error occurred while resetting progress.")
        }

        setIsOpen(false)
    }

    const markComplete = async (e: MouseEvent<HTMLDivElement>) => {
        e.preventDefault()

        if (!book.id) {
            toast.error("Failed to mark as complete - Could not determine book ID.")
            return
        }

        try {
            // Mark as complete based on book type
            const updates: BookUpdate =
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
                        },
                    }

            await updateBookMutation.mutateAsync({ bookId: book.id, book: updates })
            toast.success("Successfully marked as complete - The book has been marked as complete.")
        } catch (error) {
            toast.error("Failed to mark as complete - An error occurred while marking the book as complete.")
        }

        setIsOpen(false)
    }

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
