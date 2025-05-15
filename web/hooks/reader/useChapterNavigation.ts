import { ApiClient } from "@/lib/api/client"
import { useReaderStore } from "@/stores/reader"
import { useMutation } from "@tanstack/react-query"
import { useShallow } from "zustand/react/shallow"
import { saveLocalEpubProgress } from "../../lib/reader/bookstore"

export default function useChapterNavigation() {
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
            bookMeta: state.bookMeta,
            setProgressPercentage: state.setProgressPercentage,
        }))
    )

    const updateProgressMutation = useMutation({
        mutationFn: ({ bookId, progress }: { bookId: string; progress: any }) =>
            ApiClient.put(`/books/${bookId}/progress`, { epub_progress: progress }),
        onError: (err: Error) => {
            console.error("Failed to save remote progress:", err)
        }
    })

    const changeChapter = async (index: number) => {
        if (epubBook && bookMeta) {
            const spine = (epubBook as ePub.Book).spine.get(index)
            if (spine) {
                setLocation(spine.href)

                const progressData = {
                    loc: spine.href,
                    scrollElement: undefined,
                    globalProgress: {
                        current: charsReadInChapter,
                        total: getTotalCharsInBook(),
                    },
                }

                // Check if the book is local or cloud-based
                if (bookMeta.file_url === null) {
                    // Local book - use localforage
                    saveLocalEpubProgress(progressData, bookMeta.id).catch(
                        (err) =>
                            console.error("Failed to save local progress:", err)
                    )
                } else {
                    // Cloud book - use React Query mutation
                    updateProgressMutation.mutate({ bookId: bookMeta.id, progress: progressData })
                }

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
