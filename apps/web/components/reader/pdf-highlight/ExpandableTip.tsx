import HighlightColorOptions from "@/components/reader/HighlightOptions"
import { useReaderStore } from "@/stores/reader"
import { PdfHighlight } from "@/types/library"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { PdfSelection } from "react-pdf-highlighter-extended"
import { useShallow } from "zustand/react/shallow"
import { usePdfHighlighterContext } from "./contexts/pdf-highlighter-context"
import "./style/ExpandableTip.css"

const getNextId = () => String(Math.random()).slice(2)

interface ExpandableTipProps {
    addHighlight: (highlight: PdfHighlight) => void
}

const ExpandableTip = ({ addHighlight }: ExpandableTipProps) => {
    const [compact] = useState(true)
    const selectionRef = useRef<PdfSelection | null>(null)
    const [isInitialized, setIsInitialized] = useState(false)

    const { bookMeta } = useReaderStore(
        useShallow((state) => ({
            bookMeta: state.bookLibraryItem,
        }))
    )

    const {
        getCurrentSelection,
        removeGhostHighlight,
        setTip,
        updateTipPosition,
    } = usePdfHighlighterContext()

    useLayoutEffect(() => {
        updateTipPosition!()
    }, [compact, isInitialized, updateTipPosition])

    useEffect(() => {
        const selection = getCurrentSelection()
        if (selection) {
            selectionRef.current = selection

            setIsInitialized(true) // Mark as initialized
        }
    }, [getCurrentSelection])

    const handleHighlight = (color: string) => {
        if (!selectionRef.current || !selectionRef.current.content) {
            console.error("Selection reference or content is missing.")
            if (typeof removeGhostHighlight === "function")
                removeGhostHighlight()
            if (typeof setTip === "function") setTip(null)
            return
        }

        // Create PDF highlight with all required fields
        const highlightData: PdfHighlight = {
            book_id: bookMeta?.id ? bookMeta.id.toString() : "",
            content: selectionRef.current!.content,
            type: "text",
            position: selectionRef.current!.position,
            color: color,
            id: getNextId(),
        }

        // Add library_id if available, which will be used to get user_book_lib_id
        if (bookMeta?.library_id) {
            highlightData.library_id = bookMeta.library_id
        }

        addHighlight(highlightData)

        removeGhostHighlight()
        setTip(null)

        // Disable area selection mode after creating a highlight
        // disableAreaSelection()
    }

    if (!isInitialized) return null

    return (
        <div className="flex flex-col">
            {/* <HighlightColorOptions handleHighlight={handleHighlight}/> */}
            {/* <GeneralPopover /> */}
            <HighlightColorOptions handleHighlight={handleHighlight} />
        </div>
    )
}

export default ExpandableTip
