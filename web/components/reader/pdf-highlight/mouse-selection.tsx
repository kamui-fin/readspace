import { CSSProperties, useEffect, useRef, useState } from "react"

import { asElement, getPageFromElement, isHTMLElement } from "./lib/pdfjs-dom"
import "./style/MouseSelection.css"

import { PDFViewer } from "pdfjs-dist/types/web/pdf_viewer"
import type {
    LTWH,
    LTWHP,
    ScaledPosition,
    ViewportPosition,
} from "react-pdf-highlighter-extended"
import { viewportPositionToScaled } from "./lib/coordinates"
import screenshot from "./lib/screenshot"
import { useReaderStore } from "@/stores/reader"

type Coords = {
    x: number
    y: number
}

const getBoundingRect = (start: Coords, end: Coords): LTWH => {
    return {
        left: Math.min(end.x, start.x),
        top: Math.min(end.y, start.y),

        width: Math.abs(end.x - start.x),
        height: Math.abs(end.y - start.y),
    }
}

const getContainerCoords = (
    container: HTMLElement,
    pageX: number,
    pageY: number
) => {
    const containerBoundingRect = container.getBoundingClientRect()
    return {
        x: pageX - containerBoundingRect.left + container.scrollLeft,
        y:
            pageY -
            containerBoundingRect.top +
            container.scrollTop -
            window.scrollY,
    }
}

/**
 * The props type for {@link MouseSelection}.
 *
 * @category Component Properties
 * @internal
 */
export interface MouseSelectionProps {
    /**
     * The PDFViewer instance containing this MouseSelection.
     */
    viewer: PDFViewer

    /**
     * Callback triggered whenever the user stops dragging their mouse and a valid
     * mouse selection is made. In general, this will only be called if a mouse
     * selection is rendered.
     *
     * @param viewportPosition - viewport position of the mouse selection.
     * @param scaledPosition - scaled position of the mouse selection.
     * @param image - PNG screenshot of the mouse selection.
     * @param resetSelection - Callback to reset the current selection.
     * @param event - Mouse event associated with ending the selection.
     */
    onSelection?(
        viewportPosition: ViewportPosition,
        scaledPosition: ScaledPosition,
        image: string,
        resetSelection: () => void,
        event: MouseEvent
    ): void

    /**
     * Callback triggered whenever the current mouse selection is reset.
     * This includes when dragging ends but the selection is invalid.
     */
    onReset?(): void

    /**
     * Callback triggered whenever a new valid mouse selection begins.
     *
     * @param event - mouse event associated with the new selection.
     */
    onDragStart?(event: MouseEvent): void

    /**
     * Condition to check before any mouse selection starts.
     *
     * @param event - mouse event associated with the new selection.
     * @returns - `True` if mouse selection should start.
     */
    enableAreaSelection(event: MouseEvent): boolean

    /**
     * Callback whenever the mouse selection area changes.
     *
     * @param isVisible - Whether the mouse selection is rendered (i.e., non-zero area)
     */
    onChange?(isVisible: boolean): void

    /**
     * Optional style props for the mouse selection rectangle.
     */
    style?: CSSProperties
}

/**
 * A component that enables the creation of rectangular and interactive mouse
 * selections within a given container. NOTE: This does not disable selection in
 * whatever container the component is placed in. That must be handled through
 * the component's events.
 *
 * @category Component
 * @internal
 */
export const MouseSelection = ({
    viewer,
    onSelection,
    onReset,
    onDragStart,
    enableAreaSelection,
    onChange,
    style,
}: MouseSelectionProps) => {
    const [start, setStart] = useState<Coords | null>(null)
    const [end, setEnd] = useState<Coords | null>(null)
    const [locked, setLocked] = useState(false)
    const rootRef = useRef<HTMLDivElement | null>(null)
    const disableAreaSelection = useReaderStore(
        (state) => state.disableAreaSelection
    )
    const isAreaSelectionActive = useReaderStore(
        (state) => state.isAreaSelectionActive
    )

    // Needed in order to grab the page info of a mouse selection
    const startTargetRef = useRef<HTMLElement | null>(null)

    const reset = () => {
        if (onReset) onReset()
        setStart(null)
        setEnd(null)
        setLocked(false)
    }

    // Check for changes in enableAreaSelection function result
    useEffect(() => {
        // Create a test event to check if selection is enabled by default (for scissors mode)
        const testEvent = new MouseEvent("mousedown")
        const isSelectionEnabled = enableAreaSelection(testEvent)

        // If scissors mode is active, we should highlight the cursor
        if (isSelectionEnabled) {
            const container = rootRef.current?.parentElement
            if (container) {
                container.classList.add("area-selection-active")
            }
        } else {
            const container = rootRef.current?.parentElement
            if (container) {
                container.classList.remove("area-selection-active")
            }
        }
    }, [enableAreaSelection])

    // Register event listeners onChange
    useEffect(() => {
        if (onChange) onChange(Boolean(start && end))
        if (!rootRef.current) return

        // Should be the PdfHighlighter
        const container = asElement(rootRef.current.parentElement)

        const handleMouseUp = (event: MouseEvent) => {
            if (!start || !end || !startTargetRef.current) return

            const boundingRect = getBoundingRect(start, end)

            // Check if the bounding rectangle has a minimum width and height
            // to prevent recording selections with 0 area
            const shouldEnd =
                boundingRect.width >= 1 && boundingRect.height >= 1

            if (!container.contains(asElement(event.target)) || !shouldEnd) {
                reset()
                return
            }

            setLocked(true)

            const page = getPageFromElement(startTargetRef.current)
            if (!page) return

            const pageBoundingRect: LTWHP = {
                ...boundingRect,
                top: boundingRect.top - page.node.offsetTop,
                left: boundingRect.left - page.node.offsetLeft,
                pageNumber: page.number,
            }

            const viewportPosition: ViewportPosition = {
                boundingRect: pageBoundingRect,
                rects: [],
            }

            const scaledPosition = viewportPositionToScaled(
                viewportPosition,
                viewer
            )

            const image = screenshot(
                pageBoundingRect,
                pageBoundingRect.pageNumber,
                viewer
            )

            if (onSelection) {
                onSelection(
                    viewportPosition,
                    scaledPosition,
                    image,
                    reset,
                    event
                )
            }
        }

        const handleMouseMove = (event: MouseEvent) => {
            if (!rootRef.current || !start || locked) return
            setEnd(getContainerCoords(container, event.pageX, event.pageY))
        }

        const handleMouseDown = (event: MouseEvent) => {
            // Skip if it's a right-click (button 2)
            if (event.button === 2) {
                return
            }

            const shouldStart = (event: MouseEvent) =>
                enableAreaSelection(event) &&
                isHTMLElement(event.target) &&
                Boolean(asElement(event.target).closest(".page"))

            // If the user clicks anywhere outside a tip, reset the selection
            const shouldReset = (event: MouseEvent) =>
                start &&
                !asElement(event.target).closest(
                    ".PdfHighlighter__tip-container"
                )

            if (!shouldStart(event)) {
                if (shouldReset(event)) reset()
                return
            }

            startTargetRef.current = asElement(event.target)
            if (onDragStart) onDragStart(event)
            setStart(getContainerCoords(container, event.pageX, event.pageY))
            setEnd(null)
            setLocked(false)
        }

        /**
         * Although we register the event listeners on the PdfHighlighter component, we encapsulate
         * them in this separate component to enhance maintainability and prevent unnecessary
         * rerenders of the PdfHighlighter itself. While synthetic events on PdfHighlighter would
         * be preferable, we need to register "mouseup" on the entire document anyway. Therefore,
         * we can't avoid using useEffect. We must re-register all events on state changes, as
         * custom event listeners may otherwise receive stale state.
         */
        container.addEventListener("mousemove", handleMouseMove)
        container.addEventListener("mousedown", handleMouseDown)

        document.addEventListener("mouseup", handleMouseUp)

        return () => {
            container.removeEventListener("mousemove", handleMouseMove)
            container.removeEventListener("mousedown", handleMouseDown)
            document.removeEventListener("mouseup", handleMouseUp)
        }
    }, [start, end, enableAreaSelection])

    return (
        <div className="MouseSelection-container" ref={rootRef}>
            {start && end && (
                <div
                    className="MouseSelection"
                    style={{ ...getBoundingRect(start, end), ...style }}
                />
            )}
        </div>
    )
}
