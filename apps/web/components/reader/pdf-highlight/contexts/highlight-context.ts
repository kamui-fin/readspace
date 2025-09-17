import { createContext, useContext } from "react"
import {
    Highlight,
    HighlightBindings,
    LTWH,
    LTWHP,
    Scaled,
    ViewportHighlight,
} from "react-pdf-highlighter-extended"

/**
 * A set of utilities for rendering highlights. Designed to be used within a
 * highlight container.
 *
 * @category Context
 */
export type HighlightContainerUtils<T extends Highlight = Highlight> = {
    /**
     * The highlight being rendered at this component.
     */
    highlight: ViewportHighlight<T>

    /**
     * Convert a Viewport rectangle to a scaled rectangle. Can be used
     * for storing and updating area selection highlights, for example.
     *
     * @returns - Scaled/display agnostic rectangle.
     */
    viewportToScaled(rect: LTWHP): Scaled

    /**
     *  Capture a PNG data url of a viewport rectangle.
     *
     * @returns - PNG data url. See https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URLs
     */
    screenshot(position: LTWH): string

    /**
     * Whether the highlight has been autoscrolled to.
     */
    isScrolledTo: boolean

    /**
     * All the DOM refs for the highlights shared on the same page
     * as `highlight`
     */
    highlightBindings: HighlightBindings
}

export const HighlightContext = createContext<
    HighlightContainerUtils | undefined
>(undefined)

/**
 * Custom hook for providing {@link HighlightContainerUtils}. Must be used
 * within a child of {@link PdfHighlighter}.
 *
 * @category Context
 */
export const useHighlightContainerContext = <
    T extends Highlight = Highlight,
>() => {
    const highlightContainerUtils = useContext(HighlightContext)

    if (highlightContainerUtils === undefined) {
        throw new Error(
            "useHighlightContainerContext must be used within a child of PdfHighlighter!"
        )
    }

    return highlightContainerUtils as HighlightContainerUtils<T>
}
