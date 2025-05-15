import { toast } from "@/components/ui/sonner"
import { GradeResponse, Question } from "@/lib/api/chat"
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
import { Scaled } from "react-pdf-highlighter-extended"
import { create } from "zustand"
import { immer } from "zustand/middleware/immer"

type BookType = "epub" | "pdf"
type Book = ePub.Book | string | null
interface AIActionResult {
    content?: string
    loading?: boolean
    [key: string]: unknown
}
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

    activeAIAction: AIAction
    setActiveAIAction: (action: AIAction) => void

    // AI dialog state
    isAIDialogOpen: boolean

    // Command history removed - now using chat store

    // Abort controller for AI requests
    abortController: AbortController | null

    // flashcard state
    flashcards: Array<{ id: string; front: string; back: string }>
    flashcardDialogOpen: boolean

    isLoading: boolean // General loading state for book fetch etc.
    isRecallModalOpen: boolean // State for the recall modal visibility
    isGeneratingRecall: boolean // State for recall question generation loading
    recallMode: "quiz" | "flashcards" // Mode for active recall session

    recallTest: {
        isActive: boolean
        bookId: string | null
        questions: Question[]
        currentStep: number
        flashcards: { id: string; front: string; back: string }[]
        sessionId: string | null
        recallEndPage: number | null
        questionStates: {
            [questionId: string]: {
                chatHistory: [string, string][]
                lastFeedback: GradeResponse | null
                mcSelectedIndex?: number | null
                mcIsSubmitted?: boolean
            }
        }
        isSubmitted: boolean
        selectedIndex: number | null
        showFinalReview: boolean
        highlights: string[]
    } | null

    isAreaSelectionActive: boolean

    pageTextMap: Record<number, string>

    // Add activeTab state
    activeTab: "contents" | "highlights" | "chat"
}

export interface AIAction {
    type: string
    text: string
    result: any
    imageUrl?: string | null
    threadId?: string | null
}

// Default empty AI action
const defaultAIAction: AIAction = {
    type: "",
    text: "",
    result: null,
    imageUrl: null,
    threadId: null,
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
    setActiveAIAction: (action: AIAction) => void
    setAIDialogOpen: (isOpen: boolean) => void
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

    // Add setActiveTab action
    setActiveTab: (tab: "contents" | "highlights" | "chat") => void

    // Flashcard actions
    setFlashcards: (
        flashcards: Array<{ id: string; front: string; back: string }>
    ) => void
    addFlashcard: (flashcard: {
        id: string
        front: string
        back: string
    }) => void
    updateFlashcard: (flashcard: {
        id: string
        front: string
        back: string
    }) => void
    removeFlashcard: (id: string) => void
    setFlashcardDialogOpen: (open: boolean) => void

    fetch: (bookMeta: BookMeta) => Promise<void> // fetch book from cache or supabase

    setIsLoading: (loading: boolean) => void
    setRecallModalOpen: (open: boolean) => void // Action to control modal visibility
    setRecallMode: (mode: "quiz" | "flashcards") => void // Action to set recall mode
    setIsGeneratingRecall: (generating: boolean) => void // Action to control recall generation loading state

    startRecallTest: (
        questions: Question[],
        sessionId: string,
        bookId: string,
        recallEndPage: number
    ) => void
    updateRecallTest: (
        update: Partial<NonNullable<ReaderState["recallTest"]>>
    ) => void
    finishRecallTest: () => void
    setRecallTestHighlights: (highlights: string[]) => void
    updateQuestionChatHistory: (
        questionId: string,
        history: [string, string][]
    ) => void
    updateQuestionFeedback: (
        questionId: string,
        feedback: GradeResponse
    ) => void
    updateMultipleChoiceState: (
        questionId: string,
        selectedIndex: number | null,
        isSubmitted: boolean
    ) => void

    // Add new methods for abort controller
    setAbortController: (controller: AbortController) => void
    abortAndResetController: () => void

    // Command history actions (deprecated - use chat store instead)
    addToCommandHistory: (userMessage: string, aiResponse: string) => void
    clearCommandHistory: () => void
    getCommandHistory: () => [string, string][]

    enableAreaSelection: () => void
    disableAreaSelection: () => void

    setPageTextMap: (pageMap: Record<number, string>) => void
    getPageText: (pageNumber: number) => string

    setLastRecallPageInBookMeta: (page: number) => void
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
        activeAIAction: defaultAIAction,
        toc: [],
        currentLocation: undefined,
        currentPdfLocation: undefined,
        progressPercentage: 0,
        currentPage: 1,
        totalPages: 0,
        pdfRef: null,
        isLoading: false,
        isRecallModalOpen: false, // Initial state for modal
        isGeneratingRecall: false, // Initial state for recall generation
        recallTest: null,
        flashcards: [],
        flashcardDialogOpen: false,
        abortController: null,
        isAreaSelectionActive: false,
        pageTextMap: {},
        activeTab: "contents", // Initialize activeTab
        recallMode: "quiz",
        isAIDialogOpen: false,

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

        // Flashcard actions
        setFlashcards: (flashcards) => set({ flashcards }),
        addFlashcard: (flashcard) =>
            set((state) => {
                state.flashcards.push(flashcard)
            }),
        updateFlashcard: (flashcard) =>
            set((state) => {
                const index = state.flashcards.findIndex(
                    (f) => f.id === flashcard.id
                )
                if (index !== -1) {
                    state.flashcards[index] = flashcard
                }
            }),
        removeFlashcard: (id) =>
            set((state) => {
                state.flashcards = state.flashcards.filter((f) => f.id !== id)
            }),
        setFlashcardDialogOpen: (open) => set({ flashcardDialogOpen: open }),

        // Implement the setActiveAIAction method
        setActiveAIAction: (action) => set({ activeAIAction: action }),

        // Implement the new abort controller methods
        setAbortController: (controller) =>
            set({ abortController: controller }),
        abortAndResetController: () => {
            const controller = get().abortController
            if (controller) {
                controller.abort()
                set({ abortController: null })
            }
        },

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
                        .reduce((a, b) => a + b, 0) + charsReadInChapter
                )
            }
            return 0
        },

        getTotalCharsInBook: () => {
            const bookMeta = get().bookMeta
            if (!bookMeta) return 0

            // Check if epub_chapter_char_counts exists and is an array
            const charCounts = bookMeta.epub_chapter_char_counts || []
            return charCounts.reduce((a, b) => a + b, 0)
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
        setRecallModalOpen: (open: boolean) => set({ isRecallModalOpen: open }),
        setRecallMode: (mode: "quiz" | "flashcards") =>
            set({ recallMode: mode }),
        setIsGeneratingRecall: (generating: boolean) =>
            set({ isGeneratingRecall: generating }),

        startRecallTest: (questions, sessionId, bookId, recallEndPage) => {
            console.log(
                `Starting recall test for book ${bookId}, end page: ${recallEndPage}`
            )
            // Initialize questionStates with empty state for each question
            const questionStates = questions.reduce(
                (acc, question) => {
                    acc[question.id] = {
                        chatHistory: [],
                        lastFeedback: null,
                    }
                    return acc
                },
                {} as {
                    [key: string]: {
                        chatHistory: [string, string][]
                        lastFeedback: GradeResponse | null
                    }
                }
            )

            set({
                recallTest: {
                    isActive: false,
                    bookId,
                    questions,
                    currentStep: 0,
                    flashcards: [],
                    sessionId,
                    recallEndPage,
                    questionStates,
                    isSubmitted: false,
                    selectedIndex: null,
                    showFinalReview: false,
                    highlights: [],
                },
            })
        },

        updateRecallTest: (update) =>
            set((state) => {
                if (state.recallTest) {
                    console.log(
                        "Updating recall test with:",
                        JSON.stringify(update, null, 2)
                    )
                    console.log(
                        "Current state before update:",
                        JSON.stringify(
                            {
                                currentStep: state.recallTest.currentStep,
                                questionCount:
                                    state.recallTest.questions.length,
                                currentQuestionId:
                                    state.recallTest.questions[
                                        state.recallTest.currentStep
                                    ]?.id,
                            },
                            null,
                            2
                        )
                    )

                    Object.assign(state.recallTest, update)

                    // Log the state after update
                    const updatedStep = state.recallTest.currentStep
                    console.log(
                        "State after update:",
                        JSON.stringify(
                            {
                                currentStep: updatedStep,
                                nextQuestionId:
                                    state.recallTest.questions[updatedStep]?.id,
                                questionStates: Object.keys(
                                    state.recallTest.questionStates
                                ),
                            },
                            null,
                            2
                        )
                    )
                }
            }),

        finishRecallTest: () => set({ recallTest: null }),

        setRecallTestHighlights: (highlights) => {
            const { recallTest } = get()
            if (recallTest) {
                set({
                    recallTest: {
                        ...recallTest,
                        highlights,
                    },
                })
            }
        },

        updateQuestionChatHistory: (
            questionId: string,
            history: [string, string][]
        ) => {
            console.log(
                `Updating chat history for question ${questionId}:`,
                JSON.stringify(history, null, 2)
            )

            // Don't update state immediately to avoid render-time updates
            setTimeout(() => {
                console.log(`Inside setTimeout for question ${questionId}`)
                set((state) => {
                    if (state.recallTest?.questionStates[questionId]) {
                        console.log(
                            `Setting chat history for question ${questionId}`
                        )
                        state.recallTest.questionStates[
                            questionId
                        ].chatHistory = history
                        console.log(
                            `Chat history updated for question ${questionId}`
                        )
                    } else {
                        console.warn(
                            `Question state not found for ${questionId}`
                        )
                    }
                })
            }, 0)
        },

        updateQuestionFeedback: (
            questionId: string,
            feedback: GradeResponse
        ) => {
            console.log(
                `Updating feedback for question ${questionId}:`,
                JSON.stringify(feedback, null, 2)
            )
            set((state) => {
                if (state.recallTest?.questionStates[questionId]) {
                    state.recallTest.questionStates[questionId].lastFeedback =
                        feedback
                    console.log(`Feedback updated for question ${questionId}`)
                } else {
                    console.warn(
                        `Question state not found for feedback update on ${questionId}`
                    )
                }
            })
        },

        updateMultipleChoiceState: (
            questionId: string,
            selectedIndex: number | null,
            isSubmitted: boolean
        ) =>
            set((state) => {
                if (state.recallTest?.questionStates[questionId]) {
                    state.recallTest.questionStates[
                        questionId
                    ].mcSelectedIndex = selectedIndex
                    state.recallTest.questionStates[questionId].mcIsSubmitted =
                        isSubmitted
                }
            }),

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
                            "Failed to load book",
                            "Could not retrieve the book from cloud storage."
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
                            ? "Local book not found"
                            : "Book not available",
                        isLocalBook
                            ? "This book is stored locally but could not be found in your browser storage."
                            : "The book could not be loaded. Please try again later."
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
                // toast.error(
                //     "Error loading book",
                //     "An unexpected error occurred while loading the book."
                // )
            }
        },

        // Command history actions - replaced with no-op stubs for compatibility
        // These will be fully removed in a future update
        addToCommandHistory: (userMessage: string, aiResponse: string) => {
            console.warn(
                "addToCommandHistory is deprecated, use chat store instead"
            )
        },
        clearCommandHistory: () => {
            console.warn(
                "clearCommandHistory is deprecated, use chat store instead"
            )
        },
        getCommandHistory: () => {
            console.warn(
                "getCommandHistory is deprecated, use chat store instead"
            )
            return []
        },

        enableAreaSelection: () => set({ isAreaSelectionActive: true }),
        disableAreaSelection: () => set({ isAreaSelectionActive: false }),

        setPageTextMap: (pageMap) => set({ pageTextMap: pageMap }),
        getPageText: (pageNumber) => get().pageTextMap[pageNumber] || "",

        setLastRecallPageInBookMeta: (page: number) => {
            set((state) => {
                if (state.bookMeta) {
                    state.bookMeta.last_recall_page = page
                    console.log(
                        `Local bookMeta updated: last_recall_page set to ${page}`
                    )
                } else {
                    // This case should ideally not happen if called correctly
                    console.warn(
                        "Attempted to set last_recall_page in store, but bookMeta is null."
                    )
                }
            })
        },

        // Add setActiveTab implementation
        setActiveTab: (tab) => set({ activeTab: tab }),

        // Add setAIDialogOpen implementation
        setAIDialogOpen: (isOpen: boolean) => set({ isAIDialogOpen: isOpen }),
    }))
)
