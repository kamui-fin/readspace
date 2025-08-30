import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useDeleteBookMetadata, useUpdateBook } from "@/lib/api/hooks/books"
import { UserBookLibrary, UserBookLibraryUpdate } from "@/types/api"
import { BookOpenCheck, MoreVertical, RotateCcw, Trash } from "lucide-react"
import { MouseEvent, useState } from "react"
import toast from "react-hot-toast"

interface BookActionsProps {
    book: UserBookLibrary
}

// Type guard to check if epub_progress has the expected structure
function isEpubProgressObject(
    progress: any
): progress is { globalProgress: { current: number; total: number } } {
    return (
        progress &&
        typeof progress === "object" &&
        progress.globalProgress &&
        typeof progress.globalProgress === "object" &&
        typeof progress.globalProgress.current === "number" &&
        typeof progress.globalProgress.total === "number"
    )
}

export function BookActions({ book }: BookActionsProps) {
    const [isOpen, setIsOpen] = useState(false)
    const deleteBookMetadataMutation = useDeleteBookMetadata()
    const updateBookMutation = useUpdateBook()

    const removeBook = async (e: MouseEvent<HTMLDivElement>) => {
        e.preventDefault()

        if (!book.book_metadata?.id) {
            toast.error("Can't delete book")
            return
        }

        try {
            // Delete the book metadata (this will cascade delete the library entries)
            await deleteBookMetadataMutation.mutateAsync(book.book_metadata.id)

            toast.success("Book removed")
        } catch (error) {
            console.error("Failed to delete book:", error)
            toast.error("Delete failed")
        } finally {
            setIsOpen(false)
        }
    }

    const resetProgress = async (e: MouseEvent<HTMLDivElement>) => {
        e.preventDefault()

        if (!book.id) {
            toast.error("Can't reset progress")
            return
        }

        try {
            // Reset progress based on book type via backend API
            let updates: UserBookLibraryUpdate

            if (book.book_metadata.format === "PDF") {
                updates = { pdf_current_page: 0 }
            } else {
                // For EPUB, get the total from existing progress if available
                let total = 0
                if (isEpubProgressObject(book.epub_progress)) {
                    total = book.epub_progress.globalProgress.total
                }

                updates = {
                    epub_progress: {
                        globalProgress: {
                            current: 0,
                            total: total,
                        },
                    },
                }
            }

            await updateBookMutation.mutateAsync({
                bookId: book.id,
                book: updates,
            })
            toast.success("Progress reset")
        } catch (error) {
            console.log(error)
            const errorMessage =
                error instanceof Error && (error as any).response?.data?.detail
                    ? (error as any).response.data.detail
                    : "An error occurred while resetting progress."
            toast.error("Reset failed")
        }

        setIsOpen(false)
    }

    const markComplete = async (e: MouseEvent<HTMLDivElement>) => {
        e.preventDefault()

        if (!book.id) {
            toast.error("Can't mark complete")
            return
        }

        try {
            // Mark as complete based on book type via backend API
            let updates: UserBookLibraryUpdate

            if (book.book_metadata.format === "PDF") {
                updates = {
                    pdf_current_page: book.book_metadata.num_pages || 0,
                }
            } else {
                // For EPUB, get the total from existing progress if available
                let total = 0
                if (isEpubProgressObject(book.epub_progress)) {
                    total = book.epub_progress.globalProgress.total
                }

                updates = {
                    epub_progress: {
                        globalProgress: {
                            current: total,
                            total: total,
                        },
                    },
                }
            }

            await updateBookMutation.mutateAsync({
                bookId: book.id,
                book: updates,
            })
            toast.success("Marked complete")
        } catch (error) {
            console.log(error)
            const errorMessage =
                error instanceof Error && (error as any).response?.data?.detail
                    ? (error as any).response.data.detail
                    : "An error occurred while marking the book as complete."
            toast.error("Mark complete failed")
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
