import GeneralPopover from "@/components/reader/general-popover"
import HighlightColorOptions from "@/components/reader/highlight-options"
import { toast } from "@/components/ui/sonner"
import { useAIAction } from "@/hooks/use-ai-action"
import { useCurrentUser } from "@/hooks/use-current-user"
import { useReaderStore } from "@/stores/reader"
import { PdfHighlight } from "@/types/library"
import { getFrontendLimit } from "@/utils/limits"
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

    const {
        bookMeta,
        pageTextMap,
        pdfRef,
        totalPages,
        setFlashcards,
        setFlashcardDialogOpen,
        setActiveAIAction,
        abortAndResetController,
        setAbortController,
        disableAreaSelection,
    } = useReaderStore(
        useShallow((state) => ({
            bookMeta: state.bookMeta,
            pageTextMap: state.pageTextMap,
            pdfRef: state.pdfRef,
            totalPages: state.totalPages,
            setFlashcards: state.setFlashcards,
            setFlashcardDialogOpen: state.setFlashcardDialogOpen,
            setActiveAIAction: state.setActiveAIAction,
            abortAndResetController: state.abortAndResetController,
            setAbortController: state.setAbortController,
            disableAreaSelection: state.disableAreaSelection,
        }))
    )

    const {
        getCurrentSelection,
        removeGhostHighlight,
        setTip,
        updateTipPosition,
    } = usePdfHighlighterContext()

    // Use the AI action hook
    const { handleAIAction } = useAIAction()

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

        // --- Max Highlight Length Check ---
        const highlightLimit = getFrontendLimit(userRole, "maxHighlightLength")
        const selectedText = selectionRef.current.content.text

        if (selectedText && selectedText.length > highlightLimit) {
            toast.error(`Highlight cannot exceed ${highlightLimit} characters.`)
            if (typeof removeGhostHighlight === "function")
                removeGhostHighlight()
            if (typeof setTip === "function") setTip(null)
            if (typeof disableAreaSelection === "function") {
                disableAreaSelection()
            }
            return // Prevent adding highlight
        }
        // --- End Max Highlight Length Check ---

        // Call the existing addHighlight function
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

    const handleAIActionWrapper = async (actionType: string) => {
        const currentSelection = selectionRef.current
        if (!currentSelection) {
            console.error("No selection available for AI action.")
            return
        }

        const selectedText =
            currentSelection.content.text?.toString().trim() || ""
        const imageUrl = currentSelection.content.image
        const targetPage = currentSelection.position.boundingRect.pageNumber

        // Close the tip
        removeGhostHighlight?.()
        setTip?.(null)

        // Use the hook's handleAIAction method
        await handleAIAction(
            actionType,
            selectedText,
            userRole || "basic",
            targetPage,
            imageUrl
        )
    }

    return (
        <div className="flex flex-col">
            {/* <HighlightColorOptions handleHighlight={handleHighlight}/> */}
            <GeneralPopover handleAIAction={handleAIActionWrapper} />
            <div id="highlight-options" className="hidden mt-1">
                <HighlightColorOptions handleHighlight={handleHighlight} />
            </div>
        </div>
    )
}

export default ExpandableTip
