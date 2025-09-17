import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useDeleteBookMetadata, useUpdateBook } from "@readspace/shared"
import {
    UserBookLibrary,
    UserBookLibraryUpdate,
    isEpubProgress,
} from "@readspace/shared"
import { BookOpenCheck, MoreVertical, RotateCcw, Trash } from "lucide-react"
import { MouseEvent, useState } from "react"
import toast from "react-hot-toast"

interface BookActionsProps {
    book: UserBookLibrary
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
                if (isEpubProgress(book.epub_progress)) {
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
                if (isEpubProgress(book.epub_progress)) {
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
