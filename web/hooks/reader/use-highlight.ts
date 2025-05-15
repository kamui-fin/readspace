import { Json } from "@/database.types"
import { ApiClient } from "@/lib/api/client"
import { deserializeRange, serializeRange } from "@/lib/reader/range-serialize"
import { getTocItemForSection } from "@/lib/reader/reader-utils"
import { useReaderStore } from "@/stores/reader"
import { useMutation } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import { highlightRange } from "../../lib/reader/highlight-range"
import { EpubHighlight, Highlight, RangeRefElement } from "../../types/library"
import { useCurrentUser } from "../use-current-user"

export default function useHighlight(savedHighlights: Highlight[]) {
    const { user } = useCurrentUser()
    const { role: userRole } = user || {}

    const selectionRef = useRef<Selection>(null)
    const rangeRef = useRef<RangeRefElement>(null)
    const [isPopupOpen, setIsPopupOpen] = useState(false)
    const [highlightedText, setHighlightedText] = useState<string | null>(null)

    const {
        bookMeta,
        chapterHTML,
        highlights,
        setHighlights,
        insertHighlight,
        getCurrentChapterIdx,
        epubDocRef,
        epubBook,
        getPageProgress,
    } = useReaderStore(
        useShallow((state) => ({
            bookMeta: state.bookMeta,
            chapterHTML: state.chapterHTML,
            highlights: state.highlights,
            setHighlights: state.setHighlights,
            insertHighlight: state.insertHighlight,
            getCurrentChapterIdx: state.getCurrentChapterIdx,
            epubBook: state.book,
            getPageProgress: state.getPageProgress,
            epubDocRef: state.epubDocRef,
        }))
    )

    const addHighlightMutation = useMutation({
        mutationFn: (data: any) => ApiClient.post("/highlights", data),
        onError: (err: Error) => console.error("Failed to add highlight:", err)
    })

    const deleteHighlightMutation = useMutation({
        mutationFn: (text: string) => ApiClient.delete(`/highlights/${text}`),
        onError: (err: Error) => console.error("Failed to delete highlight:", err)
    })

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

        const selection = selectionRef.current
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

        const newHighlight: EpubHighlight = {
            book_id: bookMeta.id,
            color,
            range: serialized,
            text: selectionText,
            note: null,
            chapter: {
                idx: chapterIdx,
                href: section.href,
                title: chapterTitle?.label.trim(),
            },
            page: getPageProgress().current,
        }
        const highlight = { highlight: newHighlight, removeFn }
        insertHighlight(highlight)

        selection.removeAllRanges()
        selectionRef.current = null
        setIsPopupOpen(false)

        addHighlightMutation.mutate({
            book_id: bookMeta.id,
            color,
            text: selectionText,
            note: null,
            epub_range: serialized as unknown as Json,
            epub_chapter_idx: chapterIdx,
            epub_chapter_href: section.href,
            epub_chapter_title: chapterTitle?.label.trim(),
        })
    }

    const handleRemoveHighlight = () => {
        if (!highlightedText) return

        const toRemove = highlights.filter(
            (h) => (h.highlight as EpubHighlight).text === highlightedText
        )
        toRemove.forEach((h) => h.removeFn())

        setHighlights(
            highlights.filter(
                (hl) => (hl.highlight as EpubHighlight).text !== highlightedText
            )
        )

        deleteHighlightMutation.mutate(highlightedText)
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
        console.log("re-applying saved highlights")
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
                    { class: `highlight-${highlight.color}` },
                    (elm) => {
                        rangeRef.current = elm
                        setHighlightedText((highlight as EpubHighlight).text)
                        setIsPopupOpen(true)
                    }
                )
                return { highlight, removeFn }
            })
            .filter((h) => h !== null)
        setHighlights(loaded)
    }, [epubDocRef, savedHighlights, chapterHTML])

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
