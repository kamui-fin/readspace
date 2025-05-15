import { ApiClient } from "@/lib/api/client"
import { useReaderStore } from "@/stores/reader"
import { useMutation } from "@tanstack/react-query"
import { useCallback, useEffect } from "react"
import { useDebouncedCallback } from "use-debounce"
import { useShallow } from "zustand/react/shallow"
import { saveLocalEpubProgress } from "../../lib/reader/bookstore"
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
            bookMeta: state.bookMeta,
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
            ApiClient.put(`/books/${bookId}/progress`, { epub_progress: progress }),
        onError: (err: Error) => {
            console.error("Failed to save remote progress:", err)
        }
    })

    const debouncedOnScroll = useDebouncedCallback(() => {
        const elm = getTopVisibleElement()
        if (!elm) return
        if (progressPercentage === 100) {
            const currentChapterIdx = getCurrentChapterIdx()
            const charCounts = bookMeta?.epub_chapter_char_counts

            if (
                charCounts &&
                currentChapterIdx >= 0 &&
                currentChapterIdx < charCounts.length
            ) {
                const charsInCurrentChapter = charCounts[currentChapterIdx]
                setCharsReadInChapter(charsInCurrentChapter)
            } else {
                console.warn(
                    "Could not determine character count for completed chapter",
                    { currentChapterIdx, charCountsAvailable: !!charCounts }
                )
                const charAttr = elm.getAttribute("data-char-count") ?? "0"
                setCharsReadInChapter(parseInt(charAttr))
            }
        } else {
            const charAttr = elm.getAttribute("data-char-count") ?? "0"
            setCharsReadInChapter(parseInt(charAttr))
        }
        const sel = generateElementSelector(elm)
        if (sel && bookMeta) {
            const progressData = {
                loc: currentLocation,
                scrollElement: sel,
                globalProgress: {
                    current: getCumulativeCharsRead(),
                    total: getTotalCharsInBook(),
                },
            }

            // Check if the book is local or cloud-based
            if (bookMeta.file_url === null) {
                // Local book - use localforage
                saveLocalEpubProgress(progressData, bookMeta.id).catch((err) =>
                    console.error("Failed to save local progress:", err)
                )
            } else {
                // Cloud book - use React Query mutation
                updateProgressMutation.mutate({ bookId: bookMeta.id, progress: progressData })
            }
        }
    }, 250)

    const calcReaderProgress = useDebouncedCallback(() => {
        const container = document.getElementById("epub-container")
        if (!container) return
        const rect = container.getBoundingClientRect()
        const containerTop = rect.top + window.scrollY
        const containerHeight = rect.height
        if (containerHeight <= window.innerHeight) {
            setProgressPercentage(100)
            return
        }
        const scrollPos = window.scrollY - containerTop
        const distance = containerHeight - window.innerHeight
        let progressValue = (scrollPos / distance) * 100
        progressValue = Math.max(0, Math.min(progressValue, 100))
        setProgressPercentage(progressValue)
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

            // Check if the book is local or cloud-based
            if (bookMeta.file_url === null) {
                // Local book - use localforage
                saveLocalEpubProgress(progressData, bookMeta.id).catch((err) =>
                    console.error("Failed to save local progress:", err)
                )
            } else {
                // Cloud book - use React Query mutation
                updateProgressMutation.mutate({ bookId: bookMeta.id, progress: progressData })
            }

            setProgressPercentage(0)
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
        window.addEventListener("scroll", calcReaderProgress)
        return () => {
            window.removeEventListener("scroll", debouncedOnScroll)
            window.removeEventListener("scroll", calcReaderProgress)
        }
    }, [chapterHTML, debouncedOnScroll, calcReaderProgress, restoreScroll])

    return { restorePoint }
}
