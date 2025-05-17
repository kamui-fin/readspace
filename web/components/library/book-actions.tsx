import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useDeleteBook, useUpdateBook } from "@/lib/api/hooks/books"
import { UserBookLibrary, UserBookLibraryUpdate } from "@/types/api"
import localforage from "localforage"
import { BookOpenCheck, MoreVertical, RotateCcw, Trash } from "lucide-react"
import { MouseEvent, useState } from "react"
import toast from "react-hot-toast"

interface BookActionsProps {
    book: UserBookLibrary
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
            // Delete from database via backend API
            await deleteBookMutation.mutateAsync(book.id)

            toast.success(
                "Successfully deleted book - The book has been removed from your library."
            )

            // If the book metadata does not have a file_url (or it's an empty string),
            // it implies it might be a local-only book or was never uploaded to cloud storage.
            // In this case, try to clean it up from localforage.
            if (!book.book_metadata?.file_url && book.id) {
                try {
                    await localforage.removeItem(book.id)
                    console.log("Book removed from localforage cache.", { bookId: book.id })
                    // No need for a separate toast for this, primary success is enough.
                } catch (localError) {
                    console.error("Failed to remove book from localforage cache:", localError)
                    // Optionally, inform the user if this cleanup is critical, but generally not.
                    // toast.warn("Book removed from library, but local cache cleanup failed.");
                }
            }

        } catch (error) {
            console.log(error) // It's good practice to log the actual error
            // Check if the error has a specific message from the backend
            const errorMessage = error instanceof Error && (error as any).response?.data?.detail
                ? (error as any).response.data.detail
                : "An error occurred while deleting the book."
            toast.error(`Failed to delete book - ${errorMessage}`)
        }

        setIsOpen(false)
    }

    const resetProgress = async (e: MouseEvent<HTMLDivElement>) => {
        e.preventDefault()

        if (!book.id) {
            toast.error(
                "Failed to reset progress - Could not determine book ID."
            )
            return
        }

        try {
            // Reset progress based on book type via backend API
            const updates: UserBookLibraryUpdate =
                book.book_metadata.format === "PDF"
                    ? { pdf_current_page: 0 }
                    : {
                        epub_progress: {
                            globalProgress: {
                                current: 0,
                                total:
                                    book.epub_progress?.globalProgress
                                        ?.total || 0,
                            },
                        },
                    }

            await updateBookMutation.mutateAsync({
                bookId: book.id,
                book: updates,
            })
            toast.success(
                "Successfully reset progress - The progress for this book has been reset."
            )
        } catch (error) {
            console.log(error)
            const errorMessage = error instanceof Error && (error as any).response?.data?.detail
                ? (error as any).response.data.detail
                : "An error occurred while resetting progress."
            toast.error(`Failed to reset progress - ${errorMessage}`)
        }

        setIsOpen(false)
    }

    const markComplete = async (e: MouseEvent<HTMLDivElement>) => {
        e.preventDefault()

        if (!book.id) {
            toast.error(
                "Failed to mark as complete - Could not determine book ID."
            )
            return
        }

        try {
            // Mark as complete based on book type via backend API
            const updates: UserBookLibraryUpdate =
                book.book_metadata.format === "PDF"
                    ? { pdf_current_page: book.book_metadata.num_pages || 0 }
                    : {
                        epub_progress: {
                            globalProgress: {
                                current:
                                    book.epub_progress?.globalProgress
                                        ?.total || 0,
                                total:
                                    book.epub_progress?.globalProgress
                                        ?.total || 0,
                            },
                        },
                    }

            await updateBookMutation.mutateAsync({
                bookId: book.id,
                book: updates,
            })
            toast.success(
                "Successfully marked as complete - The book has been marked as complete."
            )
        } catch (error) {
            console.log(error)
            const errorMessage = error instanceof Error && (error as any).response?.data?.detail
                ? (error as any).response.data.detail
                : "An error occurred while marking the book as complete."
            toast.error(
                `Failed to mark as complete - ${errorMessage}`
            )
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
