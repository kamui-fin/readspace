import { cacheBook, getEpubFromCache } from "@/lib/reader/bookstore"
import { getFileFromSupabase } from "@/lib/supabase/storage"
import { BookViewProps, HighlightState } from "@/types/library"
import ePub, { NavItem } from "epubjs"
import toast from "react-hot-toast"
import { Scaled } from "react-pdf-highlighter-extended"
import { create } from "zustand"
import { immer } from "zustand/middleware/immer"

type BookType = "EPUB" | "PDF"
type Book = ePub.Book | string | null

// type Toc = NavItem | { title: string; page: number }

interface ReaderState {
    bookType: BookType | null
    bookLibraryItem: BookViewProps | null
    book: Book
    chapterHTML: string | null
    epubDocRef: HTMLDivElement | null

    highlights: HighlightState[] // Current chapter highlights (for rendering in text)
    allHighlights: HighlightState[] // All highlights for the book (for sidebar)
    charsReadInChapter: number // init to 0

    // Pending highlight to scroll to after chapter loads
    pendingHighlightScroll: any | null

    // PDF viewer reference
    pdfRef: any

    toc: NavItem[]
    currentLocation: string | undefined
    currentPdfLocation: Scaled | undefined

    progressPercentage: number

    // specific for pdf
    currentPage: number
    totalPages: number

    isLoading: boolean // General loading state for book fetch etc.
}

type ReaderActions = {
    setToc: (newToc: NavItem[]) => void
    setLocation: (newLocation: string) => void
    setPdfLocation: (newLocation: Scaled | undefined) => void

    setBookLibraryItem: (bookLibraryItem: BookViewProps) => void
    setBook: (book: Book) => void
    setChapterHTML: (html: string | null) => void
    setEpubDocRef: (ref: HTMLDivElement) => void
    setHighlights: (highlights: HighlightState[]) => void
    setAllHighlights: (highlights: HighlightState[]) => void
    setPendingHighlightScroll: (range: any | null) => void
    setTotalPages: (pages: number) => void
    insertHighlight: (highlight: HighlightState) => void
    insertAllHighlight: (highlight: HighlightState) => void
    setCharsReadInChapter: (chars: number) => void
    setCurrentPage: (page: number) => void
    getCumulativeCharsRead: () => number
    getTotalCharsInBook: () => number
    setProgressPercentage: (progress: number) => void
    getPageProgress: () => { current: number; total: number }
    getCurrentChapterIdx: () => number // get from epubBook and TocStore
    setPdfRef: (viewerRef: any) => void // PDF viewer reference setter
    goToPage: (page: number) => void // Function to navigate to a specific page

    fetch: (initialBookMeta: BookViewProps) => Promise<void>

    setIsLoading: (loading: boolean) => void
}

export const useReaderStore = create<ReaderState & ReaderActions>()(
    immer((set, get): ReaderState & ReaderActions => ({
        bookType: null,
        bookLibraryItem: null,
        book: null,
        chapterHTML: null,
        epubDocRef: null,
        highlights: [],
        allHighlights: [],
        charsReadInChapter: 0,
        toc: [],
        currentLocation: undefined,
        currentPdfLocation: undefined,
        progressPercentage: 0,
        currentPage: 1,
        totalPages: 0,
        pdfRef: null,
        isLoading: false,
        pendingHighlightScroll: null,

        setToc: (newToc) => set({ toc: newToc }),
        setLocation: (newLocation) => set({ currentLocation: newLocation }),
        setPdfLocation: (newLocation) =>
            set({ currentPdfLocation: newLocation }),

        setBookLibraryItem: (bookLibraryItem) => set({ bookLibraryItem }),
        setBook: (book: Book) => set({ book }),
        setChapterHTML: (chapterHTML) => set({ chapterHTML }),
        setEpubDocRef: (ref: HTMLDivElement) => set({ epubDocRef: ref }),
        setHighlights: (highlights) => set({ highlights }),
        setAllHighlights: (highlights) => set({ allHighlights: highlights }),
        setPendingHighlightScroll: (range: any | null) =>
            set({ pendingHighlightScroll: range }),
        setPdfRef: (pdfRef) => set({ pdfRef }),

        insertHighlight: (highlight) => {
            const { highlights } = get()
            set({ highlights: [...highlights, highlight] })
        },

        insertAllHighlight: (highlight) => {
            const { allHighlights } = get()
            set({ allHighlights: [...allHighlights, highlight] })
        },

        setCharsReadInChapter: (chars) => {
            console.log("Setting chars read in chapter:", chars)
            set({ charsReadInChapter: chars })
        },
        getCumulativeCharsRead: () => {
            const { bookLibraryItem, charsReadInChapter, bookType } = get()

            if (!bookLibraryItem) return 0

            if (bookType === "EPUB") {
                const currentChapterIdx = get().getCurrentChapterIdx()
                const charCounts =
                    bookLibraryItem.epub_chapter_char_counts || []

                return (
                    charCounts
                        .slice(0, currentChapterIdx)
                        .reduce((a: number, b: number) => a + b, 0) +
                    charsReadInChapter
                )
            }
            return 0
        },

        getTotalCharsInBook: () => {
            const { bookLibraryItem } = get()
            if (!bookLibraryItem) return 0
            const charCounts = bookLibraryItem.epub_chapter_char_counts || []
            return charCounts.reduce((a: number, b: number) => a + b, 0)
        },

        getPageProgress: () => {
            const numPagesRead = Math.ceil(
                get().getCumulativeCharsRead() / 2300
            )
            const totalNumPages = Math.ceil(get().getTotalCharsInBook() / 2300)

            return { current: numPagesRead, total: totalNumPages }
        },

        setProgressPercentage: (progress: number) =>
            set({ progressPercentage: progress }),

        getCurrentChapterIdx: () => {
            const state = get()
            if (state.bookType === "EPUB") {
                return (
                    (state.book as ePub.Book)?.spine.get(get().currentLocation)
                        ?.index || 0
                )
            }

            // if it's a pdf just return page number
            return state.currentPage
        },

        setCurrentPage: (page: number) => set({ currentPage: page }),
        setTotalPages: (pages: number) => set({ totalPages: pages }),
        goToPage: (page: number) => {
            const { pdfRef } = get()
            if (pdfRef && pdfRef.current) {
                // Ensure page is a valid number and within bounds
                const pageNumber = Number(page)
                if (pageNumber > 0 && Number.isInteger(pageNumber)) {
                    pdfRef.current.currentPageNumber = pageNumber
                } else {
                    console.error(
                        `Invalid page number: ${page}. Must be a positive integer.`
                    )
                }
            }
        },

        setIsLoading: (loading: boolean) => set({ isLoading: loading }),

        fetch: async (initialBookMeta) => {
            console.log(
                "Fetching book with initial meta (BookViewProps):",
                initialBookMeta
            )
            const bookId = initialBookMeta.id
            const bookType = initialBookMeta.format === "EPUB" ? "EPUB" : "PDF"

            let currentBookLibraryItem = { ...initialBookMeta }

            set({ isLoading: true })

            try {
                let buffer = await getEpubFromCache(bookId)

                if (!buffer && currentBookLibraryItem.file_url) {
                    const { data, success, error, message } =
                        await getFileFromSupabase(
                            currentBookLibraryItem.file_url
                        )

                    if (!success || !data) {
                        console.error(
                            "Failed to fetch book from storage:",
                            bookId,
                            error,
                            message
                        )
                        set({ isLoading: false })
                        toast.error(
                            "Failed to load book - Could not retrieve the book from cloud storage."
                        )
                        return
                    }

                    buffer = await data.arrayBuffer()
                    await cacheBook(buffer, bookId)
                }

                if (!buffer) {
                    console.error("Book not available in storage:", bookId)
                    set({ isLoading: false })
                    toast.error(
                        "Book not available - The book could not be loaded. Please try again later."
                    )
                    return
                }

                if (bookType === "EPUB") {
                    const epubBook = ePub(buffer, { replacements: "blobUrl" })
                    const nav = await epubBook.loaded.navigation
                    await epubBook.resources.replacements()

                    const location =
                        currentBookLibraryItem.epub_progress?.loc ||
                        epubBook.spine.first().href

                    set({
                        bookType: "EPUB",
                        bookLibraryItem: currentBookLibraryItem,
                        book: epubBook,
                        toc: nav.toc,
                        currentLocation: location,
                        isLoading: false,
                    })
                } else {
                    const pdfBlob = new Blob([buffer], {
                        type: "application/pdf",
                    })
                    const pdfUrl = URL.createObjectURL(pdfBlob)

                    const pdfCurrentPage =
                        typeof currentBookLibraryItem.pdf_current_page ===
                        "number"
                            ? currentBookLibraryItem.pdf_current_page
                            : currentBookLibraryItem.pdf_current_page !==
                                    null &&
                                currentBookLibraryItem.pdf_current_page !==
                                    undefined
                              ? Number(currentBookLibraryItem.pdf_current_page)
                              : 1

                    set({
                        bookType: "PDF",
                        book: pdfUrl,
                        currentPage: pdfCurrentPage,
                        bookLibraryItem: currentBookLibraryItem,
                        toc: currentBookLibraryItem.pdf_toc as unknown as NavItem[],
                        isLoading: false,
                    })
                }
            } catch (error) {
                console.error("Error loading book:", error)
                set({ isLoading: false })
                toast.error(
                    "Error loading book - An unexpected error occurred while loading the book."
                )
            }
        },
    }))
)
