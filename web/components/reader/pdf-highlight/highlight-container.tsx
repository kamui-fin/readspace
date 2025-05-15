import { AreaHighlight, TextHighlight } from "react-pdf-highlighter-extended"

import HighlightedPopover from "@/components/reader/highlighted-popover"
import { Tip } from "react-pdf-highlighter-extended"
import { PdfHighlight } from "../../../../../types/library"
import { useHighlightContainerContext } from "./contexts/HighlightContext"
import { usePdfHighlighterContext } from "./contexts/PdfHighlighterContext"
import { MonitoredHighlightContainer } from "./monitored-highlight-container"

interface HighlightContainerProps {
    deleteHighlight: (text: string) => void
    addNote: (note: string, text: string) => void
}

const HighlightContainer = ({
    deleteHighlight,
    addNote,
}: HighlightContainerProps) => {
    const { highlight, isScrolledTo, highlightBindings } =
        useHighlightContainerContext<PdfHighlight>()

    const { toggleEditInProgress } = usePdfHighlighterContext()

    let highlightColor = "rgba(255, 215, 0, 1)"

    if (highlight.color === "red") {
        highlightColor = "rgba(239,90,104,1)"
    } else if (highlight.color === "blue") {
        highlightColor = "rgba(154,208,220,1)"
    } else if (highlight.color === "green") {
        highlightColor = "rgba(201, 242, 155,1)"
    }

    const component =
        highlight.type === "text" ? (
            <TextHighlight
                isScrolledTo={isScrolledTo}
                highlight={highlight}
                style={{ background: highlightColor }}
            />
        ) : (
            <AreaHighlight
                isScrolledTo={isScrolledTo}
                highlight={highlight}
                onChange={() => {
                    toggleEditInProgress(false)
                }}
                bounds={highlightBindings.textLayer}
                onEditStart={() => toggleEditInProgress(true)}
                style={{
                    background: highlightColor,
                }}
            />
        )

    const highlightTip: Tip = {
        position: highlight.position,
        content: (
            <HighlightedPopover
                selectedHighlight={highlight}
                handleRemoveHighlight={deleteHighlight}
                handleSubmitNote={addNote}
            />
        ),
    }

    return (
        <MonitoredHighlightContainer
            highlightTip={highlightTip}
            key={highlight.id}
        >
            {component}
        </MonitoredHighlightContainer>
    )
}

export default HighlightContainer
