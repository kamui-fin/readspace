import { ReactNode, useRef } from "react"
import { Tip } from "react-pdf-highlighter-extended"
import { usePdfHighlighterContext } from "./contexts/PdfHighlighterContext"

export interface MonitoredHighlightContainerProps {
    /**
     * What tip to automatically display whenever a mouse hovers over a highlight.
     * The tip will persist even as the user puts their mouse over it and not the
     * highlight, but will disappear once it no longer hovers both.
     */
    highlightTip?: Tip
    children: ReactNode
}

export const MonitoredHighlightContainer = ({
    highlightTip,
    children,
}: MonitoredHighlightContainerProps) => {
    const mouseInRef = useRef(false) // Whether the mouse is over the child (highlight)

    const { setTip } = usePdfHighlighterContext()

    return (
        <div
            onClick={() => {
                mouseInRef.current = true
                // onMouseEnter && onMouseEnter();

                // if (isEditingOrHighlighting()) return;

                if (highlightTip) {
                    const monitoredHighlightTip = (
                        <div>{highlightTip.content}</div>
                    )

                    setTip({
                        position: highlightTip.position,
                        content: monitoredHighlightTip,
                    })
                }
            }}
            // onMouseLeave={() => {
            //     ("mouse left")
            //      mouseInRef.current = false;

            //   // Trigger onMouseLeave if no highlightTip exists
            //   !highlightTip && onMouseLeave && onMouseLeave();
            // }}
        >
            {children}
        </div>
    )
}
