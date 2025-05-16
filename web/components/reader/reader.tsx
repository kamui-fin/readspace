"use client"

import Header from "@/components/navigation/header"
import ReadingProgressBar from "@/components/reader/progress-bar"
import ReaderContent from "@/components/reader/reader-content"
import { ReaderNavActions } from "@/components/reader/reader-nav-actions"
import { useIsMobile } from "@/hooks/use-mobile"
import { useReaderStore } from "@/stores/reader"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import useChapterNavigation from "../../hooks/reader/use-chapter-navigation"
import useAutoBookmark from "../../hooks/reader/useAutoBookmark"
import { insertCharCountAttributes } from "../../lib/reader/reader-utils"
import { BookMeta, EpubHighlight } from "../../types/library"
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
    bookMeta: BookMeta
    savedHighlights: EpubHighlight[]
}

const EPUBReader = ({ bookMeta, savedHighlights }: EpubReaderProps) => {
    const bookId = bookMeta.id

    const [
        epubBook,
        fetch,
        currentLocation,
        setChapterHTML,
        getCurrentChapterIdx,
        setPageTextMap,
    ] = useReaderStore(
        useShallow((state) => [
            state.book as ePub.Book,
            state.fetch,
            state.currentLocation,
            state.setChapterHTML,
            state.getCurrentChapterIdx,
            state.setPageTextMap,
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
                    .reduce((sum, count) => sum + count, 0) || 0

            // Process the chapter content with our updated function
            const { html, pageMap } = insertCharCountAttributes(
                chapterContent,
                chapterCharCount,
                prevChapterCharCount
            )

            // Set the HTML content
            setChapterHTML(html)

            // Store the page map in the reader state
            setPageTextMap(pageMap)
            console.log(pageMap)
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
            {/* Chapter Navigation Buttons */}
            <div className="flex justify-center items-center max-w-7xl mx-auto py-8 px-4">
                <div className="bg-gray-50 rounded-lg border border-gray-100 flex items-center p-1">
                    <button
                        onClick={prevChapter}
                        className="flex items-center justify-center px-5 py-2 rounded-md transition-all duration-200 hover:bg-gray-100 active:bg-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-200"
                        aria-label="Previous chapter"
                    >
                        <ChevronLeft className="h-4 w-4 mr-1.5 text-gray-600" />
                        <span className="text-gray-700 font-medium">
                            Previous
                        </span>
                    </button>
                    <div className="mx-2 h-5 w-px bg-gray-200"></div>
                    <button
                        onClick={nextChapter}
                        className="flex items-center justify-center px-5 py-2 rounded-md transition-all duration-200 hover:bg-gray-100 active:bg-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-200"
                        aria-label="Next chapter"
                    >
                        <span className="text-gray-700 font-medium">Next</span>
                        <ChevronRight className="h-4 w-4 ml-1.5 text-gray-600" />
                    </button>
                </div>
            </div>
        </>
    )
}

export default EPUBReader
