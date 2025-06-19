import { ApiClient } from "@/lib/api/client"
import { useReaderStore } from "@/stores/reader"
import { useMutation } from "@tanstack/react-query"
import { useCallback, useEffect } from "react"
import { useDebouncedCallback } from "use-debounce"
import { useShallow } from "zustand/react/shallow"
import {
    generateElementSelector,
    getTopVisibleElement,
} from "../../lib/reader/reader-utils"
import { EpubLocation } from "../../types/library"

export default function useAutoBookmark() {
    const {
        bookMeta,
        chapterHTML,
        currentLocation,
        setLocation,
        getTotalCharsInBook,
        setCharsReadInChapter,
        progressPercentage,
        setProgressPercentage,
        getCumulativeCharsRead,
        getCurrentChapterIdx,
    } = useReaderStore(
        useShallow((state) => ({
            bookMeta: state.bookLibraryItem,
            chapterHTML: state.chapterHTML,
            currentLocation: state.currentLocation,
            getTotalCharsInBook: state.getTotalCharsInBook,
            getCumulativeCharsRead: state.getCumulativeCharsRead,
            setCharsReadInChapter: state.setCharsReadInChapter,
            progressPercentage: state.progressPercentage,
            setProgressPercentage: state.setProgressPercentage,
            setLocation: state.setLocation,
            getCurrentChapterIdx: state.getCurrentChapterIdx,
        }))
    )

    const updateProgressMutation = useMutation({
        mutationFn: ({ bookId, progress }: { bookId: string; progress: any }) =>
            ApiClient.put(`/api/books/${bookId}/progress`, {
                epub_progress: progress,
            }),
        onError: (err: Error) => {
            console.error("Failed to save remote progress:", err)
        },
    })

    const debouncedOnScroll = useDebouncedCallback(() => {
        const elm = getTopVisibleElement()
        if (!elm) return

        const sel = generateElementSelector(elm)
        if (!sel) return

        // Get character count from element
        const charAttr = elm.getAttribute("data-char-count") ?? "0"
        setCharsReadInChapter(parseInt(charAttr))

        // Calculate progress percentage based on character position in the book
        const totalChars = getTotalCharsInBook()
        const cumulativeChars = getCumulativeCharsRead()

        if (totalChars > 0) {
            const progressValue = Math.min(
                100,
                Math.max(0, (cumulativeChars / totalChars) * 100)
            )
            setProgressPercentage(progressValue)
        }

        if (sel && bookMeta) {
            const progressData = {
                loc: currentLocation,
                scrollElement: sel,
                globalProgress: {
                    current: getCumulativeCharsRead(),
                    total: getTotalCharsInBook(),
                },
            }

            // Save progress to API
            updateProgressMutation.mutate({
                bookId: bookMeta.library_id || bookMeta.id,
                progress: progressData,
            })
        }
    }, 250)

    const calcReaderProgress = useDebouncedCallback(() => {
        // Calculate progress based on character position in the book, not scroll position
        const totalChars = getTotalCharsInBook()
        const cumulativeChars = getCumulativeCharsRead()

        if (totalChars > 0) {
            const progressValue = Math.min(
                100,
                Math.max(0, (cumulativeChars / totalChars) * 100)
            )
            setProgressPercentage(progressValue)
        }
    }, 20)

    const restorePoint = (point: EpubLocation) => {
        if (point?.loc !== undefined && point.loc !== "") {
            setLocation(point.loc)
            calcReaderProgress()
        }
    }

    const restoreScroll = useCallback(async () => {
        if (!bookMeta) return
        const savedProgress = bookMeta.epub_progress
        if (
            savedProgress?.loc !== currentLocation ||
            savedProgress?.scrollElement === undefined
        ) {
            // means we switched chapters and probably want to scroll to the top
            window.scrollTo(0, 0)

            const progressData = {
                loc: currentLocation,
                scrollElement: undefined,
                globalProgress: {
                    current: getCumulativeCharsRead(),
                    total: getTotalCharsInBook(),
                },
            }

            // Save progress to API
            updateProgressMutation.mutate({
                bookId: bookMeta.library_id || bookMeta.id,
                progress: progressData,
            })

            // Calculate initial progress based on character position
            const totalChars = getTotalCharsInBook()
            const cumulativeChars = getCumulativeCharsRead()

            if (totalChars > 0) {
                const progressValue = Math.min(
                    100,
                    Math.max(0, (cumulativeChars / totalChars) * 100)
                )
                setProgressPercentage(progressValue)
            } else {
                setProgressPercentage(0)
            }
            setCharsReadInChapter(0)
        } else {
            const scrollElement = document.querySelector(
                savedProgress.scrollElement
            )
            if (scrollElement) {
                scrollElement.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                })
            }
        }
    }, [bookMeta, currentLocation, getCumulativeCharsRead, getTotalCharsInBook])

    useEffect(() => {
        if (!chapterHTML) return
        // Restore scroll position
        restoreScroll()

        window.addEventListener("scroll", debouncedOnScroll)
        // Remove the conflicting calcReaderProgress from scroll events
        return () => {
            window.removeEventListener("scroll", debouncedOnScroll)
        }
    }, [chapterHTML, debouncedOnScroll, restoreScroll])

    return { restorePoint }
}
