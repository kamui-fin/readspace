import { Json } from "@/database.types"
import { ApiClient } from "@/lib/api/client"
import { useCreateHighlight, useDeleteHighlightByText } from "@/lib/api/hooks/highlights"
import {
    deserializeRange,
    serializeRange,
    scrollToRange,
} from "@/lib/reader/range-serialize"
import { getTocItemForSection } from "@/lib/reader/reader-utils"
import { useReaderStore } from "@/stores/reader"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import { highlightRange } from "../../lib/reader/highlight-range"
import { EpubHighlight, RangeRefElement } from "../../types/library"
import { useCurrentUser } from "../use-current-user"

export default function useHighlight(savedHighlights: EpubHighlight[]) {
    const { user } = useCurrentUser()
    const { role: userRole } = user || {}
    const queryClient = useQueryClient()

    const selectionRef = useRef<Selection>(null)
    const rangeRef = useRef<RangeRefElement>(null)
    const [isPopupOpen, setIsPopupOpen] = useState(false)
    const [highlightedText, setHighlightedText] = useState<string | null>(null)

    const {
        bookMeta,
        chapterHTML,
        highlights,
        setHighlights,
        setAllHighlights,
        insertHighlight,
        insertAllHighlight,
        getCurrentChapterIdx,
        epubDocRef,
        epubBook,
        getPageProgress,
        pendingHighlightScroll,
        setPendingHighlightScroll,
    } = useReaderStore(
        useShallow((state) => ({
            bookMeta: state.bookLibraryItem,
            chapterHTML: state.chapterHTML,
            highlights: state.highlights,
            setHighlights: state.setHighlights,
            setAllHighlights: state.setAllHighlights,
            insertHighlight: state.insertHighlight,
            insertAllHighlight: state.insertAllHighlight,
            getCurrentChapterIdx: state.getCurrentChapterIdx,
            epubBook: state.book,
            getPageProgress: state.getPageProgress,
            epubDocRef: state.epubDocRef,
            pendingHighlightScroll: state.pendingHighlightScroll,
            setPendingHighlightScroll: state.setPendingHighlightScroll,
        }))
    )

    // Use the proper React Query hooks for creating and deleting highlights
    const createHighlightMutation = useCreateHighlight()
    const deleteHighlightByTextMutation = useDeleteHighlightByText()

    const onSelectStart = () => {
        selectionRef.current = null
        setIsPopupOpen(false)
    }

    const onSelectEnd = () => {
        const activeSelection = document.getSelection()
        if (
            selectionRef.current ||
            !activeSelection ||
            !activeSelection.toString() ||
            !document
                .querySelector("#epub-container")
                ?.contains(activeSelection.anchorNode)
        ) {
            selectionRef.current = null
            return
        }
        selectionRef.current = activeSelection
        const range = activeSelection.getRangeAt(0)
        rangeRef.current = range

        setIsPopupOpen(true)
    }

    const handleHighlight = (color: "yellow" | "green" | "blue") => {
        if (!bookMeta || !epubBook) return

        const selection = window.getSelection()
        if (!selection) return

        const selectionText = selection.toString()
        if (!selectionText.trim()) return // Ignore empty/whitespace selection

        const range = selection.getRangeAt(0)
        if (!epubDocRef?.contains(range.commonAncestorContainer)) return

        const serialized = serializeRange(range.cloneRange(), epubDocRef)
        const removeFn = highlightRange(
            range,
            "mark",
            { class: `highlight-${color}` },
            (elm) => {
                rangeRef.current = elm
                setHighlightedText(selectionText)
                setIsPopupOpen(true)
            }
        )
        const chapterIdx = getCurrentChapterIdx()
        const section = (epubBook as ePub.Book)?.spine.get(chapterIdx)
        const chapterTitle = getTocItemForSection(
            section,
            epubBook as ePub.Book
        )

        // Ensure color is properly formatted for the highlight object
        const normalizedColor = color.toUpperCase() as "YELLOW" | "GREEN" | "BLUE"

        const newHighlightForClientState = {
            id: crypto.randomUUID(), // Generate a temporary ID for client state
            library_id: bookMeta.id, // For client-side state model
            color: normalizedColor, // Use normalized color
            range: serialized,
            original_text: selectionText,
            note: null,
            chapter: {
                idx: chapterIdx,
                href: section.href,
                title: chapterTitle?.label.trim(),
            },
            page: getPageProgress().current,
            // Add required database fields with placeholder values
            user_book_lib_id: bookMeta.library_id || "",
            chapter_href: section.href,
            chapter_idx: chapterIdx,
            chapter_title: chapterTitle?.label.trim(),
            html_range: serialized as unknown as Json,
            pdf_rect_position: null,
        } as unknown as EpubHighlight
        const highlightForStore = {
            highlight: newHighlightForClientState,
            removeFn,
        }
        insertHighlight(highlightForStore)

        // Also add to allHighlights for the sidebar
        insertAllHighlight(highlightForStore)

        selection.removeAllRanges()
        selectionRef.current = null
        setIsPopupOpen(false)

        // Construct payload for the server, matching HighlightCreate schema (via HighlightBase)
        const payloadForServer = {
            user_book_lib_id: bookMeta.library_id || "", // Use library_id from bookMeta
            original_text: selectionText,
            color: normalizedColor, // Use normalized color
            note: null,
            html_range: serialized as unknown as Json,
            chapter_idx: chapterIdx,
            chapter_href: section.href,
            chapter_title: chapterTitle?.label.trim() || null, // Convert undefined to null
            page: getPageProgress().current,
            pdf_rect_position: null, // Explicitly null for EPUB highlights, as per HighlightBase
        }

        // Use the React Query mutation which will handle cache invalidation
        createHighlightMutation.mutate(payloadForServer, {
            onSuccess: (response) => {
                console.log("Highlight created successfully:", response)
                // Manually invalidate cache with correct book ID
                const bookId = bookMeta?.library_id // Use library_id to match React Query book ID
                if (bookId) {
                    queryClient.invalidateQueries({
                        queryKey: ["highlights", bookId],
                    })
                }
                // Optionally update the temporary highlight with the real ID from server
                // This ensures consistency between client and server state
            },
            onError: (error) => {
                console.error("Failed to create highlight:", error)
                // Remove the highlight from local state if server creation failed
                setHighlights(
                    highlights.filter(
                        (hl) =>
                            (hl.highlight as EpubHighlight).original_text !==
                            selectionText
                    )
                )
                const { allHighlights } = useReaderStore.getState()
                setAllHighlights(
                    allHighlights.filter(
                        (hl) =>
                            (hl.highlight as EpubHighlight).original_text !==
                            selectionText
                    )
                )
                removeFn() // Remove the highlight visualization
            },
        })
    }

    const handleRemoveHighlight = () => {
        if (!highlightedText) return

        const toRemove = highlights.filter(
            (h) =>
                (h.highlight as EpubHighlight).original_text === highlightedText
        )
        toRemove.forEach((h) => h.removeFn())

        setHighlights(
            highlights.filter(
                (hl) =>
                    (hl.highlight as EpubHighlight).original_text !==
                    highlightedText
            )
        )

        // Also remove from allHighlights
        const { allHighlights } = useReaderStore.getState()
        setAllHighlights(
            allHighlights.filter(
                (hl) =>
                    (hl.highlight as EpubHighlight).original_text !==
                    highlightedText
            )
        )

        deleteHighlightByTextMutation.mutate(highlightedText)
        setIsPopupOpen(false)
        rangeRef.current = null
    }

    useEffect(() => {
        document.addEventListener("selectstart", onSelectStart)
        document.addEventListener("mouseup", onSelectEnd)
        return () => {
            document.removeEventListener("selectstart", onSelectStart)
            document.removeEventListener("mouseup", onSelectEnd)
        }
    }, [chapterHTML])

    useEffect(() => {
        if (epubDocRef == null) return
        // re-apply saved highlights

        // Set all highlights for the sidebar (no filtering)
        const allHighlightsForStore = savedHighlights.map((highlight) => ({
            highlight,
            removeFn: () => {}, // Placeholder function since highlights in sidebar don't need removal
        }))
        setAllHighlights(allHighlightsForStore)

        // Set current chapter highlights (filtered) for rendering in the text
        const loaded = savedHighlights
            .filter(
                (h) =>
                    (h as EpubHighlight).chapter.idx === getCurrentChapterIdx()
            )
            .map((highlight) => {
                const range = deserializeRange(
                    (highlight as EpubHighlight).range,
                    epubDocRef
                )
                if (!range) return null
                const removeFn = highlightRange(
                    range,
                    "mark",
                    { class: `highlight-${highlight.color?.toLowerCase()}` }, // Ensure lowercase for CSS class
                    (elm) => {
                        rangeRef.current = elm
                        setHighlightedText(
                            (highlight as EpubHighlight).original_text
                        )
                        setIsPopupOpen(true)
                    }
                )
                return { highlight, removeFn }
            })
            .filter((h) => h !== null)
        setHighlights(loaded)
    }, [epubDocRef, savedHighlights, chapterHTML])

    // Handle pending highlight scroll after chapter loads
    useEffect(() => {
        if (epubDocRef && pendingHighlightScroll && chapterHTML) {
            // Small delay to ensure the DOM is fully rendered
            setTimeout(() => {
                const range = deserializeRange(
                    pendingHighlightScroll,
                    epubDocRef
                )
                if (range) {
                    scrollToRange(range)
                    // Clear the pending scroll
                    setPendingHighlightScroll(null)
                }
            }, 100)
        }
    }, [
        epubDocRef,
        pendingHighlightScroll,
        chapterHTML,
        setPendingHighlightScroll,
    ])

    return {
        isPopupOpen,
        setIsPopupOpen,
        highlightedText,
        setHighlightedText,
        highlights,
        handleHighlight,
        handleRemoveHighlight,
        rangeRef,
        selectionRef,
    }
}
