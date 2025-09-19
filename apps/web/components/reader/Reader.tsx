"use client"

import Header from "@/components/navigation/Header"
import ReadingProgressBar from "@/components/reader/ProgressBar"
import ReaderContent from "@/components/reader/ReaderContent"
import { ReaderNavActions } from "@/components/reader/ReaderNavActions"
import useAutoBookmark from "@/hooks/reader/useAutoBookmark"
import useChapterNavigation from "@/hooks/reader/useChapterNavigation"
import { useIsMobile } from "@/hooks/useMobile"
import { insertCharCountAttributes } from "@/lib/reader/reader-utils"
import { useReaderStore } from "@/stores/reader"
import { BookViewProps, EpubHighlight } from "@/types/library"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import HighlightPopover from "./HighlightPopover"

// Custom hook for scroll direction detection
const useScrollDirection = (
    containerRef: React.RefObject<HTMLElement | null>
) => {
    const [isScrollingUp, setIsScrollingUp] = useState(true)
    const lastScrollY = useRef(0)

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY
            const direction =
                currentScrollY > lastScrollY.current ? "down" : "up"

            if (direction !== (isScrollingUp ? "up" : "down")) {
                setIsScrollingUp(direction === "up")
            }

            lastScrollY.current = currentScrollY
        }

        window.addEventListener("scroll", handleScroll, { passive: true })
        return () => window.removeEventListener("scroll", handleScroll)
    }, [isScrollingUp])

    return isScrollingUp
}
interface EpubReaderProps {
    bookMeta: BookViewProps
    savedHighlights: EpubHighlight[]
}

const EPUBReader = ({ bookMeta, savedHighlights }: EpubReaderProps) => {
    console.log(savedHighlights)
    const bookId = bookMeta.id

    const [
        epubBook,
        fetch,
        currentLocation,
        setChapterHTML,
        getCurrentChapterIdx,
    ] = useReaderStore(
        useShallow((state) => [
            state.book as ePub.Book,
            state.fetch,
            state.currentLocation,
            state.setChapterHTML,
            state.getCurrentChapterIdx,
            state.epubDocRef,
        ])
    )

    const { restorePoint } = useAutoBookmark()
    // useKeyboardNavigation()
    const { nextChapter, prevChapter } = useChapterNavigation()

    useEffect(() => {
        fetch(bookMeta).then(() => {
            if (bookMeta.epub_progress) {
                restorePoint(bookMeta.epub_progress)
            }
        })
    }, [bookMeta])

    useEffect(() => {
        const loadChapter = async () => {
            if (!epubBook) return

            const chapter = currentLocation
                ? epubBook.spine.get(currentLocation)
                : epubBook.spine.first()
            const chapterContent = await chapter.render(
                epubBook.load.bind(epubBook)
            )
            const chapterCharCount =
                bookMeta.epub_chapter_char_counts?.[getCurrentChapterIdx()] || 0

            const prevChapterCharCount =
                bookMeta.epub_chapter_char_counts
                    ?.slice(0, getCurrentChapterIdx())
                    .reduce((sum: number, count: number) => sum + count, 0) || 0

            // Process the chapter content with our updated function
            const { html } = insertCharCountAttributes(
                chapterContent,
                chapterCharCount,
                prevChapterCharCount
            )

            // Set the HTML content
            setChapterHTML(html)
        }

        loadChapter()
    }, [currentLocation])

    // Auto-hide the app sidebar for better reading experience
    // const { setOpen } = useSidebarLeft()
    // useEffect(() => {
    //     setOpen(false)
    // }, [])

    const readerRef = useRef<HTMLDivElement>(null)
    const isScrollingUp = useScrollDirection(readerRef)
    const isMobile = useIsMobile()

    // Mouse proximity logic
    const [showHeader, setShowHeader] = useState(true)
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setShowHeader(e.clientY < 48)
        }
        window.addEventListener("mousemove", handleMouseMove)
        return () => window.removeEventListener("mousemove", handleMouseMove)
    }, [])

    // Combine scroll and mouse proximity logic
    const headerVisible = showHeader || isScrollingUp

    return (
        <>
            <ReadingProgressBar />
            <Header
                classAttributes={`sticky top-0 z-2 bg-background border-b shadow-sm transition-all duration-200 ${headerVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"}`}
                breadcrumbItems={
                    isMobile
                        ? [
                            {
                                href: `/library/${bookId}`,
                                label: bookMeta.title.slice(0, 15) + "...",
                            },
                        ]
                        : [
                            { href: "/library", label: "Home" },
                            {
                                href: `/library/${bookId}`,
                                label:
                                    bookMeta.title.length > 30
                                        ? `${bookMeta.title.substring(0, 30)}...`
                                        : bookMeta.title,
                            },
                        ]
                }
            >
                <ReaderNavActions />
            </Header>
            <div ref={readerRef}>
                <ReaderContent />
            </div>
            <HighlightPopover savedHighlights={savedHighlights} />
            {/* Chapter Navigation Buttons */}
            <div className="flex justify-center items-center max-w-7xl mx-auto py-8 px-4">
                <div className="bg-muted rounded-lg border border-border flex items-center p-1">
                    <button
                        onClick={prevChapter}
                        className="flex items-center justify-center px-5 py-2 rounded-md transition-all duration-200 hover:bg-background active:bg-background/80 focus:outline-none focus:ring-1 focus:ring-ring"
                        aria-label="Previous chapter"
                    >
                        <ChevronLeft className="h-4 w-4 mr-1.5 text-muted-foreground" />
                        <span className="text-foreground font-medium">
                            Previous
                        </span>
                    </button>
                    <div className="mx-2 h-5 w-px bg-border"></div>
                    <button
                        onClick={nextChapter}
                        className="flex items-center justify-center px-5 py-2 rounded-md transition-all duration-200 hover:bg-background active:bg-background/80 focus:outline-none focus:ring-1 focus:ring-ring"
                        aria-label="Next chapter"
                    >
                        <span className="text-foreground font-medium">
                            Next
                        </span>
                        <ChevronRight className="h-4 w-4 ml-1.5 text-muted-foreground" />
                    </button>
                </div>
            </div>
        </>
    )
}

export default EPUBReader
