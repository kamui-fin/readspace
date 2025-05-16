"use client"

import { useReaderStore } from "@/stores/reader"
import { ZoomValue } from "@/types/library"
import { useCallback, useEffect } from "react"
import { useShallow } from "zustand/react/shallow"
import { BookMeta, HighlightState } from "../../types/library"

import { useRef, useState } from "react"
import { PdfLoader } from "react-pdf-highlighter-extended"

import { PdfHighlighterUtils } from "@/components/reader/pdf-highlight/contexts/PdfHighlighterContext"
import ExpandableTip from "@/components/reader/pdf-highlight/expandable-tip"
import HighlightContainer from "@/components/reader/pdf-highlight/highlight-container"
import { PdfHighlighter } from "@/components/reader/pdf-highlight/pdf-highlights"
import { PdfHighlight } from "../../types/library"

import { Loading } from "@/components/reader/reader-content"
import { ApiClient } from "@/lib/api/client"
import { saveLocalPdfProgress } from "@/lib/reader/bookstore"
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
    bookMeta: BookMeta // PDF file source (URL, File object, or base64)
    savedHighlights: PdfHighlight[] // Pass saved highlights from your data
}

export const PDFViewer = ({ bookMeta, savedHighlights }: PDFViewerProps) => {
    const currentPageRef = useRef(useReaderStore.getState().currentPage)
    const [isLoading, setIsLoading] = useState(true)
    const [viewerReady, setViewerReady] = useState(false)

    // Initialize zoom state from localStorage
    const [currentZoom, setCurrentZoom] = useState<ZoomValue>(() => {
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

    // Use the highlights from the global store instead of local state
    const { pdfBook, fetchBook, highlights, insertHighlight, setHighlights } =
        useReaderStore(
            useShallow((state) => ({
                pdfBook: state.book,
                fetchBook: state.fetch,
                highlights: state.highlights,
                insertHighlight: state.insertHighlight,
                setHighlights: state.setHighlights,
            }))
        )

    // Get only the PDF highlight objects from the store's highlight states
    const pdfHighlights = highlights
        .map((h) => h.highlight)
        .filter((h) => "position" in h) as PdfHighlight[]

    const isSavingRef = useRef(false)
    const hasSetInitialPage = useRef(false)
    const isComponentInitialized = useRef(false)

    // Get isAreaSelectionActive state from the store
    const isAreaSelectionActive = useReaderStore(
        (state) => state.isAreaSelectionActive
    )

    // Auto-hide the app sidebar for better reading experience
    // const { setOpen } = useSidebarLeft()
    // useEffect(() => {
    //     setOpen(false)
    // }, [])

    const updateProgressMutation = useMutation({
        mutationFn: ({ bookId, page }: { bookId: string; page: number }) =>
            ApiClient.put(`/books/${bookId}/progress`, { pdf_page: page }),
        onError: (err: Error) => {
            console.error("Failed to save remote progress:", err)
        },
    })

    const addHighlightMutation = useMutation({
        mutationFn: (data: any) => ApiClient.post("/highlights", data),
        onError: (err: Error) => console.error("Failed to add highlight:", err),
    })

    const deleteHighlightMutation = useMutation({
        mutationFn: (text: string) => ApiClient.delete(`/highlights/${text}`),
        onError: (err: Error) =>
            console.error("Failed to delete highlight:", err),
    })

    const addAnnotationMutation = useMutation({
        mutationFn: ({ note, text }: { note: string; text: string }) =>
            ApiClient.put(`/highlights/${text}/note`, { note }),
        onError: (err: Error) =>
            console.error("Failed to add annotation:", err),
    })

    useEffect(() => {
        const initialize = async () => {
            try {
                await fetchBook(bookMeta)
                // Initialize the store with saved highlights
                setHighlights(
                    savedHighlights.map(
                        (h): HighlightState => ({
                            highlight: h,
                            removeFn: () => {},
                        })
                    )
                )
                setIsLoading(false)
                setViewerReady(true)
            } catch (error) {
                console.error("Error initializing book:", error)
                setIsLoading(false)
            }
        }

        initialize()

        return () => {
            isComponentInitialized.current = false
        }
    }, [bookMeta, fetchBook])

    const saveProgress = (pageLeftOff: number) => {
        if (bookMeta.file_url === null) {
            saveLocalPdfProgress(pageLeftOff, bookMeta.id)
        } else {
            updateProgressMutation.mutate({
                bookId: bookMeta.id,
                page: pageLeftOff,
            })
        }
    }

    useEffect(() => {
        // Don't set up event listeners until component is fully initialized
        if (!viewerReady || isLoading) return

        // Mark component as initialized once viewer is ready
        isComponentInitialized.current = true

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            const pageLeftOff = useReaderStore.getState().currentPage
            if (!isSavingRef.current) {
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
            if (!isSavingRef.current) {
                const pageLeftOff = useReaderStore.getState().currentPage
                // Save progress based on book type
                if (bookMeta.file_url === null) {
                    // Local book - use localforage
                    saveLocalPdfProgress(pageLeftOff, bookMeta.id).catch(
                        (err) =>
                            console.error(
                                "Failed to save local PDF progress:",
                                err
                            )
                    )
                } else {
                    // Cloud book - use server action
                    updateProgressMutation.mutate({
                        bookId: bookMeta.id,
                        page: pageLeftOff,
                    })
                }
            }
        }
    }, [bookMeta.id, viewerReady, isLoading])

    const handlePageChange = useCallback((pageNumber: number) => {
        currentPageRef.current = pageNumber
        useReaderStore.getState().setCurrentPage(pageNumber)
        saveProgress(pageNumber)
    }, [])

    const handleZoomChange = useCallback((zoom: ZoomValue) => {
        setCurrentZoom(zoom)
        // No need to save to localStorage since it's already done in pdf-zoom.tsx
    }, [])

    // Initialize page when viewer is ready
    useEffect(() => {
        const viewer = highlighterUtilsRef.current?.getViewer()
        if (!viewer || isLoading) return

        // Set initial page once when viewer loads
        if (!hasSetInitialPage.current && bookMeta.pdf_page) {
            const initialPage = Math.min(bookMeta.pdf_page, viewer.pagesCount)
            currentPageRef.current = initialPage
            viewer.currentPageNumber = initialPage
            hasSetInitialPage.current = true
        }

        const handlePageChanged = (event: { pageNumber: number }) => {
            if (event.pageNumber !== currentPageRef.current) {
                currentPageRef.current = event.pageNumber
                useReaderStore.getState().setCurrentPage(event.pageNumber)
            }
        }

        viewer.eventBus.on("pagechanging", handlePageChanged)
        window.addEventListener("beforeunload", function (event) {
            event.stopImmediatePropagation()
        })

        setViewerReady(true)

        return () => {
            viewer.eventBus.off("pagechanging", handlePageChanged)
            window.removeEventListener("beforeunload", function (event) {
                event.stopImmediatePropagation()
            })
        }
    }, [isLoading, bookMeta.pdf_page])

    const handleTotalPagesChange = useCallback((pages: number) => {
        useReaderStore.getState().setTotalPages(pages)
    }, [])

    const onAddNewHighlight = useCallback(
        async (highlight: PdfHighlight) => {
            // Add highlight directly to the Zustand store
            insertHighlight({ highlight, removeFn: () => {} })

            if (highlight.content.text) {
                await addHighlightMutation.mutateAsync({
                    book_id: bookMeta.id,
                    text: highlight.content.text,
                    color: highlight.color || "yellow",
                    pdf_rect_position: highlight.position,
                })
            }
        },
        [insertHighlight]
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

            setHighlights(updatedHighlights)
            await deleteHighlightMutation.mutateAsync(highlightText)
        },
        [highlights, setHighlights]
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

            setHighlights(updatedHighlights)
            await addAnnotationMutation.mutateAsync({ note, text: textToAddTo })
        },
        [highlights, setHighlights]
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
                    {(pdfDocument) => (
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
                            }}
                            pdfScaleValue={currentZoom}
                            textSelectionColor={undefined}
                            startPage={bookMeta.pdf_page || 1}
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
                    )}
                </PdfLoader>
            </div>
        </div>
    )
}
