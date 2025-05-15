import {
    Highlighter
} from "lucide-react"

import { usePdfHighlighterContext } from "@/components/reader/pdf-highlight/contexts/PdfHighlighterContext"
import { Separator } from "@/components/ui/separator"
import { useReaderStore } from "@/stores/reader"
import { useEffect, useState } from "react"
import { Button } from "../ui/button"

const GeneralPopover = () => {
    const bookType = useReaderStore((state) => state.bookType)
    const [showHighlightButton, setShowHighlightButton] = useState(true)

    let getCurrentSelection = undefined

    if (bookType === "pdf") {
        getCurrentSelection = usePdfHighlighterContext().getCurrentSelection
    }

    useEffect(() => {
        if (getCurrentSelection) {
            const selection = getCurrentSelection()
            if (selection?.type === "area" && selection.content.image) {
                setShowHighlightButton(false)
            } else {
                setShowHighlightButton(true)
            }
        }
    }, [getCurrentSelection])

    // Handle highlight button click
    const handleHighlightClick = () => {
        const highlightOptions = document.getElementById("highlight-options")
        if (highlightOptions) {
            highlightOptions.classList.toggle("hidden")
        }
    }

    return (
        <div className="p-1 rounded-md border shadow-md w-auto z-50 bg-background">
            <div className="flex items-center gap-1">
                {/* Highlight button */}
                {showHighlightButton && (
                    <>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 cursor-pointer flex items-center gap-2"
                            onClick={handleHighlightClick}
                            title="Highlight"
                        >
                            <Highlighter className="h-4 w-4" />
                        </Button>
                        <Separator
                            orientation="vertical"
                            className="h-6 mx-1"
                        />
                    </>
                )}
            </div>
        </div>
    )
}

export default GeneralPopover
