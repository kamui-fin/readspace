import { ApiClient } from "@readspace/shared"
import { useReaderStore } from "@/stores/reader"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useShallow } from "zustand/react/shallow"

export default function useChapterNavigation() {
    const queryClient = useQueryClient()
    const {
        getCurrentChapterIdx,
        setProgressPercentage,
        charsReadInChapter,
        setCharsReadInChapter,
        getTotalCharsInBook,
        setLocation,
        epubBook,
        bookMeta,
    } = useReaderStore(
        useShallow((state) => ({
            getCurrentChapterIdx: state.getCurrentChapterIdx,
            charsReadInChapter: state.charsReadInChapter,
            setCharsReadInChapter: state.setCharsReadInChapter,
            getTotalCharsInBook: state.getTotalCharsInBook,
            setLocation: state.setLocation,
            epubBook: state.book,
            bookMeta: state.bookLibraryItem,
            setProgressPercentage: state.setProgressPercentage,
        }))
    )

    const updateProgressMutation = useMutation({
        mutationFn: ({ bookId, progress }: { bookId: string; progress: any }) =>
            ApiClient.books.updateBookProgress(bookId, {
                epub_progress: progress,
            }),
        onSuccess: () => {
            // Invalidate highlights cache when progress is updated
            // This ensures highlights are refreshed when navigating chapters
            // Use the library_id which should match the URL param used for fetching highlights
            const bookId = bookMeta?.library_id // Use library_id to match React Query
            if (bookId) {
                queryClient.invalidateQueries({
                    queryKey: ["highlights", bookId],
                })
            }
        },
        onError: (err: Error) => {
            console.error("Failed to save remote progress:", err)
        },
    })

    const changeChapter = async (index: number) => {
        if (epubBook && bookMeta) {
            const spine = (epubBook as ePub.Book).spine.get(index)
            if (spine) {
                setLocation(spine.href)
                updateProgressMutation.mutate({
                    bookId: bookMeta.library_id || bookMeta.id,
                    progress: {
                        loc: spine.href,
                        scrollElement: undefined,
                        globalProgress: {
                            current: charsReadInChapter,
                            total: getTotalCharsInBook(),
                        },
                    },
                })
                setProgressPercentage(0)
                setCharsReadInChapter(0)
            }
        }
    }

    const nextChapter = () => {
        const currIndex = getCurrentChapterIdx()
        if (currIndex !== undefined) changeChapter(currIndex + 1)
    }

    const prevChapter = () => {
        const currIndex = getCurrentChapterIdx()
        if (currIndex !== undefined) changeChapter(currIndex - 1)
    }

    return { nextChapter, prevChapter, changeChapter }
}
