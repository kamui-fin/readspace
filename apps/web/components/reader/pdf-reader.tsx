"use client"

import { useReaderStore } from "@/stores/reader"
import { ZoomValue } from "@/types/library"
import { useCallback, useEffect } from "react"
import { useShallow } from "zustand/react/shallow"
import {
    BookViewProps,
    HighlightState,
    PdfHighlight,
} from "../../types/library"
import type {
    UserBookLibraryProgressResponse,
    HighlightCreateRequest,
    HighlightColor,
} from "../../types/api"

import { useRef, useState } from "react"
import { PdfLoader } from "react-pdf-highlighter-extended"

import { PdfHighlighterUtils } from "@/components/reader/pdf-highlight/contexts/PdfHighlighterContext"
import ExpandableTip from "@/components/reader/pdf-highlight/expandable-tip"
import HighlightContainer from "@/components/reader/pdf-highlight/highlight-container"
import { PdfHighlighter } from "@/components/reader/pdf-highlight/pdf-highlights"

import { Loading } from "@/components/reader/reader-content"
import { ApiClient } from "@readspace/shared"
import { useMutation } from "@tanstack/react-query"
import { pdfjs } from "react-pdf"

// Global storage key for zoom preference (same as in pdf-zoom.tsx)
const STORAGE_KEY = "pdf-zoom-level"

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
).toString()

const parseIdFromHash = () => {
    return document.location.hash.slice("#highlight-".length)
}

const resetHash = () => {
    document.location.hash = ""
}

interface PDFViewerProps {
    bookMeta: BookViewProps // Changed from BookMeta to BookViewProps
    savedHighlights: PdfHighlight[]
}

export const PDFViewer = ({ bookMeta, savedHighlights }: PDFViewerProps) => {
    const currentPageRef = useRef(useReaderStore.getState().currentPage)
    const [isLoading, setIsLoading] = useState(true)
    const [viewerReady, setViewerReady] = useState(false)

    // Initialize zoom state from localStorage
    const [currentZoom] = useState<ZoomValue>(() => {
        // Default to "auto" when running on server or no saved value exists
        if (typeof window === "undefined") return "auto"

        try {
            const savedZoom = localStorage.getItem(STORAGE_KEY)
            if (savedZoom) {
                return JSON.parse(savedZoom)
            }
        } catch (error) {
            console.error("Error loading zoom from localStorage:", error)
        }

        return "auto" // Default zoom
    })

    const highlighterUtilsRef = useRef<PdfHighlighterUtils>(null)

    // Get all store functions we need
    const {
        pdfBook,
        fetchBook,
        highlights,
        insertHighlight,
        setHighlights,
        setAllHighlights,
        insertAllHighlight,
        goToPage,
    } = useReaderStore(
        useShallow((state) => ({
            pdfBook: state.book,
            fetchBook: state.fetch,
            highlights: state.highlights,
            insertHighlight: state.insertHighlight,
            setHighlights: state.setHighlights,
            setAllHighlights: state.setAllHighlights,
            insertAllHighlight: state.insertAllHighlight,
            goToPage: state.goToPage,
        }))
    )

    // Get only the PDF highlight objects from the store's highlight states
    const pdfHighlights = highlights
        .map((h) => h.highlight)
        .filter((h) => "position" in h) as PdfHighlight[]

    const isSavingRef = useRef(false)
    const hasSetInitialPage = useRef(false)
    const isComponentInitialized = useRef(false)

    // Get isAreaSelectionActive state from the store, with fallback if it doesn't exist
    const isAreaSelectionActive = useReaderStore(
        (state) =>
            (state as { isAreaSelectionActive?: boolean })
                .isAreaSelectionActive ?? false
    )

    // Auto-hide the app sidebar for better reading experience
    // const { setOpen } = useSidebarLeft()
    // useEffect(() => {
    //     setOpen(false)
    // }, [])

    const updateProgressMutation = useMutation({
        mutationFn: ({ bookId, page }: { bookId: string; page: number }) => {
            console.log("API CALL: Saving progress to server", { bookId, page })
            return ApiClient.put(`/api/books/${bookId}/progress`, {
                pdf_current_page: page,
            })
        },
        onSuccess: (response) => {
            console.log("API SUCCESS: Progress saved successfully", response)
        },
        onError: (err: Error) => {
            console.error("API ERROR: Failed to save remote progress:", err)
        },
    })

    const addHighlightMutation = useMutation({
        mutationFn: (data: HighlightCreateRequest) =>
            ApiClient.post("/api/highlights/", data),
        onError: (err: Error) => console.error("Failed to add highlight:", err),
    })

    const deleteHighlightMutation = useMutation({
        mutationFn: (text: string) =>
            ApiClient.delete(
                `/api/highlights/text/${encodeURIComponent(text)}`
            ),
        onError: (err: Error) =>
            console.error("Failed to delete highlight:", err),
    })

    const addAnnotationMutation = useMutation({
        mutationFn: ({ note, text }: { note: string; text: string }) =>
            ApiClient.put(
                `/api/highlights/text/${encodeURIComponent(text)}/note`,
                { note }
            ),
        onError: (err: Error) =>
            console.error("Failed to add annotation:", err),
    })

    useEffect(() => {
        const initialize = async () => {
            try {
                // Log the initial bookMeta from BookViewProps
                console.log("INITIAL BOOK VIEW PROPS (PDFViewer):", {
                    id: bookMeta.id, // This is BookMetadata.id
                    library_id: bookMeta.library_id, // This is UserBookLibrary.id
                    pdf_current_page: bookMeta.pdf_current_page,
                    format: bookMeta.format,
                    title: bookMeta.title,
                })

                // The fetchBook action in the store will receive the full BookViewProps
                await fetchBook(bookMeta)

                // Initialize the store with saved highlights
                const highlightStates = savedHighlights.map(
                    (h): HighlightState => ({
                        highlight: h,
                        removeFn: () => {}, // Placeholder, actual remove logic might be elsewhere
                    })
                )
                setHighlights(highlightStates)
                setAllHighlights(highlightStates)

                // Set initial page using pdf_current_page from BookViewProps
                if (
                    bookMeta.pdf_current_page !== null &&
                    bookMeta.pdf_current_page !== undefined
                ) {
                    const pageNumber = Number(bookMeta.pdf_current_page)

                    if (!isNaN(pageNumber)) {
                        console.log(
                            "Setting initial page from bookMeta.pdf_current_page:",
                            pageNumber
                        )
                        // setCurrentPage directly on the store instance if needed, or rely on goToPage
                        useReaderStore.getState().setCurrentPage(pageNumber)
                        currentPageRef.current = pageNumber
                        // Ensure the viewer navigates to this page
                        // Note: goToPage might be called internally by PdfHighlighter based on initialScrollTo
                        // or you might need to call it if PdfHighlighter doesn't handle it from a prop.
                        // For now, assuming PdfHighlighter or its setup handles initial page.
                        // If not, uncomment:
                        // goToPage(pageNumber);
                    } else {
                        console.warn(
                            "pdf_current_page is not a valid number:",
                            bookMeta.pdf_current_page
                        )
                    }
                } else {
                    console.log(
                        "No pdf_current_page found in bookMeta, starting from page 1 or default."
                    )
                }

                setIsLoading(false)
                setViewerReady(true)
            } catch (error) {
                console.error("Error initializing book in PDFViewer:", error)
                setIsLoading(false)
            }
        }

        initialize()

        // Cleanup function if needed
        return () => {
            // Perform any cleanup, e.g., resetting component-specific state
            // isComponentInitialized.current = false; // Example, if you still use this ref
        }
        // Ensure dependencies are correct. bookMeta might be complex; consider destructuring if it causes re-runs.
        // For now, keeping bookMeta as is, but be mindful of its stability.
    }, [
        bookMeta,
        fetchBook,
        setHighlights,
        setAllHighlights,
        insertAllHighlight,
        savedHighlights,
    ]) // Removed goToPage if not directly called here

    const saveProgress = useCallback(
        (pageLeftOff: number) => {
            // Ensure bookMeta is available
            if (!bookMeta) {
                console.error("saveProgress called without bookMeta. Skipping.")
                return
            }

            console.log(
                "Attempting to save progress for page:",
                pageLeftOff,
                "bookMeta.id:",
                bookMeta.id,
                "bookMeta.library_id:",
                bookMeta.library_id
            )

            // Update the local store/ref regardless of where we're saving
            currentPageRef.current = pageLeftOff
            useReaderStore.getState().setCurrentPage(pageLeftOff)

            // Save progress to API
            let libraryIdToUse: string | null | undefined = bookMeta.library_id

            if (!libraryIdToUse) {
                const pathParts = window.location.pathname.split("/")
                // Assuming URL structure like /reader/pdf/{library_id}
                // Adjust index if your URL structure is different
                if (
                    pathParts.length >= 3 &&
                    pathParts[pathParts.length - 2] === "pdf"
                ) {
                    libraryIdToUse = pathParts[pathParts.length - 1]
                    console.log(
                        "Extracted library_id from URL:",
                        libraryIdToUse
                    )
                }
            }

            // CRITICAL: Only proceed if we have a valid libraryIdToUse
            // DO NOT fall back to bookMeta.id for cloud saves.
            if (libraryIdToUse) {
                console.log(
                    "Saving progress to API for library ID:",
                    libraryIdToUse
                )
                updateProgressMutation.mutate({
                    bookId: libraryIdToUse, // This is UserBookLibrary.id
                    page: pageLeftOff,
                })
            } else {
                console.warn(
                    "Could not determine library_id for cloud book. Progress not saved to API.",
                    "bookMeta.library_id:",
                    bookMeta.library_id,
                    "pathname:",
                    window.location.pathname
                )
            }

            // Also update the bookMeta prop directly if it's being used for current page reference by UI
            // This is a local mutation of the prop, be cautious if this prop is also managed by parent state.
            if (bookMeta) {
                // Check again as it might have been undefined initially
                bookMeta.pdf_current_page = pageLeftOff
            }
        },
        [bookMeta, updateProgressMutation]
    )

    // For debugging, make an initial check to see what page we're starting with
    useEffect(() => {
        const checkInitialPage = async () => {
            if (bookMeta.library_id) {
                try {
                    console.log(
                        "CHECKING INITIAL PAGE for library ID:",
                        bookMeta.library_id
                    )
                    const response =
                        await ApiClient.get<UserBookLibraryProgressResponse>(
                            `/api/books/${bookMeta.library_id}`
                        )

                    console.log("INITIAL PAGE CHECK RESPONSE:", response)

                    if (
                        typeof response?.pdf_current_page === "number" &&
                        response.pdf_current_page > 0
                    ) {
                        console.log(
                            "Found initial page from API:",
                            response.pdf_current_page
                        )
                        // Update bookMeta and store state
                        bookMeta.pdf_current_page = response.pdf_current_page
                        currentPageRef.current = response.pdf_current_page
                        useReaderStore
                            .getState()
                            .setCurrentPage(response.pdf_current_page)

                        // Use goToPage to navigate to the right page
                        goToPage(response.pdf_current_page)
                        hasSetInitialPage.current = true
                    }
                } catch (err) {
                    console.error("Error in initial page check:", err)
                }
            }
        }

        checkInitialPage()
    }, [bookMeta, goToPage])

    // Add a sequence tracker to ensure we prioritize loading the saved page
    const pageLoadSequence = useRef({
        initialLoadComplete: false,
        manualPageSetAttempted: false,
    })

    // Effect to save progress when the component unmounts or browser tab changes
    useEffect(() => {
        // Don't set up event listeners until component is fully initialized
        if (!viewerReady || isLoading) return

        // Mark component as initialized once viewer is ready
        isComponentInitialized.current = true

        // Capture ref value at the start of the effect
        const isSavingRef_captured = isSavingRef

        const handleBeforeUnload = () => {
            const pageLeftOff = useReaderStore.getState().currentPage
            if (!isSavingRef_captured.current) {
                saveProgress(pageLeftOff)
            }
        }

        const handleVisibilityChange = () => {
            const pageLeftOff = useReaderStore.getState().currentPage
            if (document.visibilityState === "hidden") {
                saveProgress(pageLeftOff)
            }
        }

        // Setup event listeners
        window.addEventListener("beforeunload", handleBeforeUnload)
        document.addEventListener("visibilitychange", handleVisibilityChange)

        // Cleanup
        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload)
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange
            )

            // Save when component unmounts (SPA navigation)
            if (!isSavingRef_captured.current) {
                const pageLeftOff = useReaderStore.getState().currentPage
                // Save progress to API
                const pathParts = window.location.pathname.split("/")
                const libraryIdFromUrl =
                    pathParts.length > 2
                        ? pathParts[pathParts.length - 1]
                        : null
                const libraryId =
                    libraryIdFromUrl || bookMeta.library_id || bookMeta.id
                updateProgressMutation.mutate({
                    bookId: libraryId,
                    page: pageLeftOff,
                })
            }
        }
    }, [
        bookMeta.id,
        bookMeta.library_id,
        viewerReady,
        isLoading,
        saveProgress,
        updateProgressMutation,
    ])

    // Add a useEffect hook to ensure currentPage is correctly synchronized with bookMeta.pdf_current_page
    useEffect(() => {
        if (
            bookMeta.pdf_current_page &&
            !pageLoadSequence.current.initialLoadComplete
        ) {
            console.log(
                "PDF Reader: Setting current page from bookMeta",
                bookMeta.pdf_current_page
            )
            useReaderStore.getState().setCurrentPage(bookMeta.pdf_current_page)
            currentPageRef.current = bookMeta.pdf_current_page
            pageLoadSequence.current.initialLoadComplete = true

            // Use goToPage instead of direct viewer access
            goToPage(bookMeta.pdf_current_page)
            pageLoadSequence.current.manualPageSetAttempted = true
        }
    }, [bookMeta.pdf_current_page, goToPage])

    const handlePageChange = useCallback(
        (pageNumber: number) => {
            currentPageRef.current = pageNumber
            useReaderStore.getState().setCurrentPage(pageNumber)
            saveProgress(pageNumber)
        },
        [saveProgress]
    )

    const handleTotalPagesChange = useCallback((pages: number) => {
        useReaderStore.getState().setTotalPages(pages)
    }, [])

    const onAddNewHighlight = useCallback(
        async (highlight: PdfHighlight) => {
            // Add highlight directly to the Zustand store
            const highlightState = { highlight, removeFn: () => {} }
            insertHighlight(highlightState)
            insertAllHighlight(highlightState) // Also add to allHighlights for sidebar

            if (highlight.content.text) {
                // Use HighlightCreateRequest interface
                const highlightData: HighlightCreateRequest = {
                    user_book_lib_id: bookMeta.library_id || "",
                    original_text: highlight.content.text,
                    color:
                        (highlight.color?.toUpperCase() as HighlightColor) ||
                        "YELLOW",
                    pdf_rect_position: highlight.position,
                }

                // Fallback: try to get library_id from URL if not available in bookMeta
                if (!bookMeta.library_id) {
                    const pathParts = window.location.pathname.split("/")
                    const libraryIdFromUrl =
                        pathParts.length > 2
                            ? pathParts[pathParts.length - 1]
                            : null
                    if (libraryIdFromUrl) {
                        highlightData.user_book_lib_id = libraryIdFromUrl
                    }
                }

                await addHighlightMutation.mutateAsync(highlightData)
            }
        },
        [
            insertHighlight,
            insertAllHighlight,
            bookMeta.library_id,
            addHighlightMutation,
        ]
    )

    const deleteHighlight = useCallback(
        async (highlightText: string) => {
            if (!highlightText) return

            // Filter out the highlight from the store
            const updatedHighlights = highlights.filter(
                (h) =>
                    "position" in h.highlight &&
                    (h.highlight as PdfHighlight).content.text !== highlightText
            )

            // Also filter from allHighlights
            const { allHighlights } = useReaderStore.getState()
            const updatedAllHighlights = allHighlights.filter(
                (h) =>
                    "position" in h.highlight &&
                    (h.highlight as PdfHighlight).content.text !== highlightText
            )

            setHighlights(updatedHighlights)
            setAllHighlights(updatedAllHighlights)
            await deleteHighlightMutation.mutateAsync(highlightText)
        },
        [highlights, setHighlights, setAllHighlights, deleteHighlightMutation]
    )

    const addNote = useCallback(
        async (note: string, textToAddTo: string) => {
            // Update the note in the store
            const updatedHighlights = highlights.map((h) => {
                if (
                    "position" in h.highlight &&
                    (h.highlight as PdfHighlight).content.text === textToAddTo
                ) {
                    return {
                        ...h,
                        highlight: {
                            ...(h.highlight as PdfHighlight),
                            note,
                        },
                    }
                }
                return h
            })

            // Also update in allHighlights
            const { allHighlights } = useReaderStore.getState()
            const updatedAllHighlights = allHighlights.map((h) => {
                if (
                    "position" in h.highlight &&
                    (h.highlight as PdfHighlight).content.text === textToAddTo
                ) {
                    return {
                        ...h,
                        highlight: {
                            ...(h.highlight as PdfHighlight),
                            note,
                        },
                    }
                }
                return h
            })

            setHighlights(updatedHighlights)
            setAllHighlights(updatedAllHighlights)
            await addAnnotationMutation.mutateAsync({ note, text: textToAddTo })
        },
        [highlights, setHighlights, setAllHighlights, addAnnotationMutation]
    )

    // Scroll to highlight based on hash in the URL
    const scrollToHighlightFromHash = useCallback(() => {
        const id = parseIdFromHash()
        const highlight = pdfHighlights.find((h) => h.id === id)

        if (highlight && highlighterUtilsRef.current) {
            highlighterUtilsRef.current.scrollToHighlight(highlight)
        }
    }, [pdfHighlights])

    // Hash listeners for autoscrolling to highlights
    useEffect(() => {
        window.addEventListener("hashchange", scrollToHighlightFromHash)

        return () => {
            window.removeEventListener("hashchange", scrollToHighlightFromHash)
        }
    }, [scrollToHighlightFromHash])

    if (isLoading || !pdfBook) return <Loading />
    return (
        <div
            className="flex flex-col h-[100vh]"
            style={{ overflow: "hidden", position: "relative", flexGrow: 1 }}
        >
            <div>
                <PdfLoader
                    document={pdfBook as string}
                    beforeLoad={() => {
                        return (
                            <div className="h-full w-full bg-background">
                                <Loading />
                            </div>
                        )
                    }}
                >
                    {(pdfDocument) => {
                        // Force load the current page from the store - this ensures we're using the latest value
                        const storeCurrentPage =
                            useReaderStore.getState().currentPage
                        // Calculate startPage here to ensure we always have the most up-to-date value
                        // Prioritize the currentPage from store over bookMeta.pdf_current_page
                        const startPageToUse =
                            storeCurrentPage > 1
                                ? storeCurrentPage
                                : bookMeta.pdf_current_page || 1
                        console.log(
                            "PDF Reader: Using start page",
                            startPageToUse,
                            "store page:",
                            storeCurrentPage,
                            "meta page:",
                            bookMeta.pdf_current_page
                        )

                        return (
                            <PdfHighlighter
                                bookId={bookMeta.id}
                                bookTitle={bookMeta.title}
                                enableAreaSelection={(event) =>
                                    event.altKey || isAreaSelectionActive
                                }
                                onPageChange={handlePageChange}
                                pdfDocument={pdfDocument}
                                onScrollAway={resetHash}
                                utilsRef={(_pdfHighlighterUtils) => {
                                    highlighterUtilsRef.current =
                                        _pdfHighlighterUtils
                                    // Force jump to page once utils are ready
                                    if (
                                        !hasSetInitialPage.current &&
                                        _pdfHighlighterUtils?.getViewer()
                                    ) {
                                        // Use the previously calculated startPageToUse here
                                        console.log(
                                            "PDF Reader: Forcing jump to initial page in utilsRef:",
                                            startPageToUse
                                        )
                                        try {
                                            // Immediately try to set the page
                                            if (startPageToUse > 1) {
                                                // Use goToPage from the store instead of direct viewer access
                                                goToPage(startPageToUse)
                                                hasSetInitialPage.current = true
                                                console.log(
                                                    "PDF Reader: Successfully set initial page to",
                                                    startPageToUse
                                                )
                                            }

                                            // Also schedule additional attempts with delays
                                            setTimeout(() => {
                                                if (
                                                    !hasSetInitialPage.current &&
                                                    startPageToUse > 1
                                                ) {
                                                    console.log(
                                                        "PDF Reader: Setting page with delay to",
                                                        startPageToUse
                                                    )
                                                    goToPage(startPageToUse)
                                                    hasSetInitialPage.current = true
                                                }
                                            }, 200)

                                            setTimeout(() => {
                                                if (
                                                    !hasSetInitialPage.current &&
                                                    startPageToUse > 1
                                                ) {
                                                    console.log(
                                                        "PDF Reader: Setting page with longer delay to",
                                                        startPageToUse
                                                    )
                                                    goToPage(startPageToUse)
                                                    hasSetInitialPage.current = true
                                                }
                                            }, 500)
                                        } catch (err) {
                                            console.error(
                                                "Error setting page in utilsRef:",
                                                err
                                            )
                                        }
                                    }
                                }}
                                pdfScaleValue={currentZoom}
                                textSelectionColor={undefined}
                                startPage={startPageToUse}
                                selectionTip={
                                    <div>
                                        <ExpandableTip
                                            addHighlight={onAddNewHighlight}
                                        />
                                    </div>
                                }
                                highlights={pdfHighlights}
                                onTotalPagesChange={handleTotalPagesChange}
                            >
                                <HighlightContainer
                                    deleteHighlight={deleteHighlight}
                                    addNote={addNote}
                                />
                            </PdfHighlighter>
                        )
                    }}
                </PdfLoader>
            </div>
        </div>
    )
}
