import {
    cacheBook,
    getEpubFromCache,
    getLocalEpubProgress,
    getLocalPdfProgress,
    initializeBookProgressStorage,
} from "@/lib/reader/bookstore"
import { getFileFromSupabase } from "@/lib/supabase/storage"
import { BookMeta, HighlightState } from "@/types/library"
import ePub, { NavItem } from "epubjs"
import toast from "react-hot-toast"
import { Scaled } from "react-pdf-highlighter-extended"
import { create } from "zustand"
import { immer } from "zustand/middleware/immer"

type BookType = "epub" | "pdf"
type Book = ePub.Book | string | null

// type Toc = NavItem | { title: string; page: number }

interface ReaderState {
    bookType: BookType | null
    bookMeta: BookMeta | null
    book: Book
    chapterHTML: string | null
    epubDocRef: HTMLDivElement | null

    highlights: HighlightState[]
    charsReadInChapter: number // init to 0

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

    setBookMeta: (bookMeta: BookMeta) => void
    setBook: (book: Book) => void
    setChapterHTML: (html: string | null) => void
    setEpubDocRef: (ref: HTMLDivElement) => void
    setHighlights: (highlights: HighlightState[]) => void
    setTotalPages: (pages: number) => void
    insertHighlight: (highlight: HighlightState) => void
    setCharsReadInChapter: (chars: number) => void
    setCurrentPage: (page: number) => void
    getCumulativeCharsRead: () => number
    getTotalCharsInBook: () => number
    setProgressPercentage: (progress: number) => void
    getPageProgress: () => { current: number; total: number }
    getCurrentChapterIdx: () => number // get from epubBook and TocStore
    setPdfRef: (viewerRef: any) => void // PDF viewer reference setter
    goToPage: (page: number) => void // Function to navigate to a specific page

    fetch: (bookMeta: BookMeta) => Promise<void> // fetch book from cache or supabase

    setIsLoading: (loading: boolean) => void
}

export const useReaderStore = create<ReaderState & ReaderActions>()(
    immer((set, get): ReaderState & ReaderActions => ({
        bookType: null,
        bookMeta: null,
        book: null,
        chapterHTML: null,
        epubDocRef: null,
        highlights: [],
        charsReadInChapter: 0,
        toc: [],
        currentLocation: undefined,
        currentPdfLocation: undefined,
        progressPercentage: 0,
        currentPage: 1,
        totalPages: 0,
        pdfRef: null,
        isLoading: false,

        setToc: (newToc) => set({ toc: newToc }),
        setLocation: (newLocation) => set({ currentLocation: newLocation }),
        setPdfLocation: (newLocation) =>
            set({ currentPdfLocation: newLocation }),

        setBookMeta: (bookMeta) => set({ bookMeta }),
        setBook: (book: Book) => set({ book }),
        setChapterHTML: (chapterHTML) => set({ chapterHTML }),
        setEpubDocRef: (ref: HTMLDivElement) => set({ epubDocRef: ref }),
        setHighlights: (highlights) => set({ highlights }),
        setPdfRef: (pdfRef) => set({ pdfRef }),

        insertHighlight: (highlight) => {
            const { highlights } = get()
            set({ highlights: [...highlights, highlight] })
        },

        setCharsReadInChapter: (chars) => {
            console.log("Setting chars read in chapter:", chars)
            set({ charsReadInChapter: chars })
        },
        getCumulativeCharsRead: () => {
            const { bookMeta, charsReadInChapter, bookType } = get()

            if (!bookMeta) return 0

            if (bookType === "epub") {
                const currentChapterIdx = get().getCurrentChapterIdx()

                // Check if epub_chapter_char_counts exists and is an array
                const charCounts = bookMeta.epub_chapter_char_counts || []

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
            const bookMeta = get().bookMeta
            if (!bookMeta) return 0

            // Check if epub_chapter_char_counts exists and is an array
            const charCounts = bookMeta.epub_chapter_char_counts || []
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
            if (state.bookType === "epub") {
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
                pdfRef.current.currentPageNumber = page
            }
        },

        setIsLoading: (loading: boolean) => set({ isLoading: loading }),

        fetch: async (bookMeta) => {
            const bookId = bookMeta.id
            const bookType = bookMeta.type === "epub" ? "epub" : "pdf"
            const isLocalBook = bookMeta.file_url === null

            set({ isLoading: true })

            try {
                // Try to get book from cache first
                let buffer = await getEpubFromCache(bookId)

                // If not in cache and it's a cloud book, fetch from Supabase
                if (!buffer && !isLocalBook && bookMeta.file_url) {
                    const { data, success, error, message } =
                        await getFileFromSupabase(bookMeta.file_url)

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

                    // Convert Blob to ArrayBuffer and cache it
                    buffer = await data.arrayBuffer()
                    await cacheBook(buffer, bookId)
                }

                // If still no buffer, the book is not available
                if (!buffer) {
                    console.error(
                        isLocalBook
                            ? "Local book not found in cache:"
                            : "Book not available in storage:",
                        bookId
                    )
                    set({ isLoading: false })
                    toast.error(
                        isLocalBook
                            ? "Local book not found - This book is stored locally but could not be found in your browser storage."
                            : "Book not available - The book could not be loaded. Please try again later."
                    )
                    return
                }

                // For local books, ensure progress storage is initialized and load from localforage
                if (isLocalBook) {
                    // Initialize storage if needed
                    await initializeBookProgressStorage(bookId, bookType)

                    if (bookType === "epub") {
                        const localProgress = await getLocalEpubProgress(bookId)
                        if (localProgress) {
                            bookMeta.epub_progress = localProgress as any
                        }
                    } else {
                        const localPage = await getLocalPdfProgress(bookId)
                        if (localPage !== null) {
                            bookMeta.pdf_page = localPage
                        }
                    }
                }

                // Process book based on type (EPUB or PDF)
                if (bookType === "epub") {
                    // Load EPUB
                    const epubBook = ePub(buffer, { replacements: "blobUrl" })
                    const nav = await epubBook.loaded.navigation
                    await epubBook.resources.replacements()

                    // Get location from epub_progress or use the first page
                    const location =
                        bookMeta.epub_progress?.loc ||
                        epubBook.spine.first().href

                    set({
                        bookType: "epub",
                        bookMeta,
                        book: epubBook,
                        toc: nav.toc,
                        currentLocation: location,
                        isLoading: false,
                    })
                } else {
                    // Handle PDF
                    const pdfBlob = new Blob([buffer], {
                        type: "application/pdf",
                    })
                    const pdfUrl = URL.createObjectURL(pdfBlob)

                    set({
                        bookType: "pdf",
                        book: pdfUrl,
                        currentPage: bookMeta.pdf_page || 1,
                        bookMeta,
                        toc: bookMeta.pdf_toc as unknown as NavItem[],
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
