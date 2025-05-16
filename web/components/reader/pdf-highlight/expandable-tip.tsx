import GeneralPopover from "@/components/reader/general-popover"
import HighlightColorOptions from "@/components/reader/highlight-options"
import { useCurrentUser } from "@/hooks/use-current-user"
import { useReaderStore } from "@/stores/reader"
import { PdfHighlight } from "@/types/library"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { PdfSelection } from "react-pdf-highlighter-extended"
import { useShallow } from "zustand/react/shallow"
import { usePdfHighlighterContext } from "./contexts/PdfHighlighterContext"
import "./style/ExpandableTip.css"

const getNextId = () => String(Math.random()).slice(2)

interface ExpandableTipProps {
    addHighlight: (highlight: PdfHighlight) => void
}

const ExpandableTip = ({ addHighlight }: ExpandableTipProps) => {
    const { user } = useCurrentUser()
    const { role: userRole } = user || {}

    const [compact] = useState(true)
    const selectionRef = useRef<PdfSelection | null>(null)
    const [isInitialized, setIsInitialized] = useState(false)

    const { bookMeta, disableAreaSelection } = useReaderStore(
        useShallow((state) => ({
            bookMeta: state.bookMeta,
            disableAreaSelection: state.disableAreaSelection,
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
    }, [compact, isInitialized])

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

        addHighlight({
            book_id: bookMeta?.id ? bookMeta.id.toString() : "",
            content: selectionRef.current!.content,
            type: "text",
            position: selectionRef.current!.position,
            color: color,
            id: getNextId(),
        })

        removeGhostHighlight()
        setTip(null)

        // Disable area selection mode after creating a highlight
        // disableAreaSelection()
    }

    if (!isInitialized) return null

    return (
        <div className="flex flex-col">
            {/* <HighlightColorOptions handleHighlight={handleHighlight}/> */}
            <GeneralPopover />
            <div id="highlight-options" className="hidden mt-1">
                <HighlightColorOptions handleHighlight={handleHighlight} />
            </div>
        </div>
    )
}

export default ExpandableTip
