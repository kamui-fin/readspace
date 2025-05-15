import "./style/PdfHighlighter.css"
import "./style/PdfViewer.css"

import debounce from "lodash.debounce"
import { PDFDocumentProxy } from "pdfjs-dist"
import {
    createContext,
    CSSProperties,
    PointerEventHandler,
    ReactNode,
    useContext,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react"
import { createRoot } from "react-dom/client"
import {
    Content,
    GhostHighlight,
    Highlight,
    HighlightBindings,
    PdfScaleValue,
    PdfSelection,
    Tip,
    ViewportPosition,
} from "react-pdf-highlighter-extended"
import {
    PdfHighlighterContext,
    PdfHighlighterUtils,
} from "./contexts/PdfHighlighterContext"
import { HighlightLayer } from "./highlight-layer"
import { scaledToViewport, viewportPositionToScaled } from "./lib/coordinates"
import getBoundingRect from "./lib/get-bounding-rect"
import getClientRects from "./lib/get-client-rects"
import groupHighlightsByPage from "./lib/group-highlights-by-page"
import {
    asElement,
    findOrCreateContainerLayer,
    getPagesFromRange,
    getWindow,
    isHTMLElement,
} from "./lib/pdfjs-dom"
import { MouseSelection } from "./mouse-selection"
import { TipContainer } from "./tip-container"

import { updateBookLanguage } from "@/app/(protected)/library/[id]/actions"
import Header from "@/components/navigation/header"
import ReadingProgressBar from "@/components/reader/progress-bar"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { SidebarRightTrigger, useSidebarRight } from "@/components/ui/sidebar"
import { useIsMobile } from "@/hooks/use-mobile"
import { useReaderStore } from "@/stores/reader"
import { Globe } from "lucide-react"
import type {
    EventBus as TEventBus,
    PDFLinkService as TPDFLinkService,
    PDFViewer as TPDFViewer,
} from "pdfjs-dist/web/pdf_viewer.mjs"
import PageNumberInput from "./page-selector"
import { PdfZoom } from "./pdf-zoom"

// Language options from reader-nav-actions.tsx
const LANGUAGE_OPTIONS: Array<{ value: string; label: string }> = [
    { value: "Arabic (ar)", label: "Arabic (ar)" },
    { value: "Bengali (bn)", label: "Bengali (bn)" },
    { value: "Bulgarian (bg)", label: "Bulgarian (bg)" },
    { value: "Chinese (zh)", label: "Chinese (zh)" },
    { value: "Croatian (hr)", label: "Croatian (hr)" },
    { value: "Czech (cs)", label: "Czech (cs)" },
    { value: "Danish (da)", label: "Danish (da)" },
    { value: "Dutch (nl)", label: "Dutch (nl)" },
    { value: "English (en)", label: "English (en)" },
    { value: "Estonian (et)", label: "Estonian (et)" },
    { value: "Finnish (fi)", label: "Finnish (fi)" },
    { value: "French (fr)", label: "French (fr)" },
    { value: "German (de)", label: "German (de)" },
    { value: "Greek (el)", label: "Greek (el)" },
    { value: "Hebrew (iw)", label: "Hebrew (iw)" },
    { value: "Hindi (hi)", label: "Hindi (hi)" },
    { value: "Hungarian (hu)", label: "Hungarian (hu)" },
    { value: "Indonesian (id)", label: "Indonesian (id)" },
    { value: "Italian (it)", label: "Italian (it)" },
    { value: "Japanese (ja)", label: "Japanese (ja)" },
    { value: "Korean (ko)", label: "Korean (ko)" },
    { value: "Latvian (lv)", label: "Latvian (lv)" },
    { value: "Lithuanian (lt)", label: "Lithuanian (lt)" },
    { value: "Norwegian (no)", label: "Norwegian (no)" },
    { value: "Polish (pl)", label: "Polish (pl)" },
    { value: "Portuguese (pt)", label: "Portuguese (pt)" },
    { value: "Romanian (ro)", label: "Romanian (ro)" },
    { value: "Russian (ru)", label: "Russian (ru)" },
    { value: "Serbian (sr)", label: "Serbian (sr)" },
    { value: "Slovak (sk)", label: "Slovak (sk)" },
    { value: "Slovenian (sl)", label: "Slovenian (sl)" },
    { value: "Spanish (es)", label: "Spanish (es)" },
    { value: "Swahili (sw)", label: "Swahili (sw)" },
    { value: "Swedish (sv)", label: "Swedish (sv)" },
    { value: "Thai (th)", label: "Thai (th)" },
    { value: "Turkish (tr)", label: "Turkish (tr)" },
    { value: "Ukrainian (uk)", label: "Ukrainian (uk)" },
    { value: "Vietnamese (vi)", label: "Vietnamese (vi)" },
]

let EventBus: typeof TEventBus,
    PDFLinkService: typeof TPDFLinkService,
    PDFViewer: typeof TPDFViewer
;(async () => {
    // Due to breaking changes in PDF.js 4.0.189. See issue #17228
    const pdfjs = await import("pdfjs-dist/web/pdf_viewer.mjs")
    EventBus = pdfjs.EventBus
    PDFLinkService = pdfjs.PDFLinkService
    PDFViewer = pdfjs.PDFViewer
})()

const SCROLL_MARGIN = 10
const DEFAULT_SCALE_VALUE = 0.1
const DEFAULT_TEXT_SELECTION_COLOR = "rgba(153,193,218,255)"

const findOrCreateHighlightLayer = (textLayer: HTMLElement) => {
    return findOrCreateContainerLayer(
        textLayer,
        "PdfHighlighter__highlight-layer"
    )
}

const disableTextSelection = (
    viewer: InstanceType<typeof PDFViewer>,
    flag: boolean
) => {
    viewer.viewer?.classList.toggle("PdfHighlighter--disable-selection", flag)
}

// Create a context to share the zooming state
interface ZoomContextType {
    isZooming: boolean
    setIsZooming: (value: boolean) => void
}

const ZoomContext = createContext<ZoomContextType | null>(null)

export const useZoomContext = () => {
    const context = useContext(ZoomContext)
    if (!context) {
        throw new Error("useZoomContext must be used within a ZoomProvider")
    }
    return context
}

export const useScrollDirection = (
    containerRef: React.RefObject<HTMLElement | null>
) => {
    const [isScrollingUp, setIsScrollingUp] = useState(true)
    const lastScrollTop = useRef(0)
    const isZoomingRef = useRef(false)

    // Create a function to set the zooming state that can be accessed from outside
    const setIsZooming = (value: boolean) => {
        isZoomingRef.current = value
    }

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const handleScroll = () => {
            // Skip scroll direction update if we're zooming
            if (isZoomingRef.current) return

            const currentScrollTop = container.scrollTop

            // Update state only when scroll position changes
            if (currentScrollTop !== lastScrollTop.current) {
                setIsScrollingUp(currentScrollTop < lastScrollTop.current)
                lastScrollTop.current = currentScrollTop
            }
        }

        // Set isZooming to true when zooming starts
        const handleZoomStart = () => {
            isZoomingRef.current = true
        }

        // Reset isZooming after zoom operation completes
        const handleZoomEnd = () => {
            isZoomingRef.current = false
        }

        container.addEventListener("scroll", handleScroll)

        // Add event listeners for zoom operations
        const viewer = container.querySelector(".pdfViewer")
        if (viewer) {
            viewer.addEventListener("wheel", (e: Event) => {
                // Check if the wheel event is a zoom operation (Ctrl+wheel or pinch zoom)
                const wheelEvent = e as WheelEvent
                if (wheelEvent.ctrlKey || wheelEvent.metaKey) {
                    handleZoomStart()
                    // Reset after a short delay to allow zoom to complete
                    setTimeout(handleZoomEnd, 300)
                }
            })
        }

        return () => {
            container.removeEventListener("scroll", handleScroll)
            const viewer = container.querySelector(".pdfViewer")
            if (viewer) {
                viewer.removeEventListener("wheel", handleZoomStart)
            }
        }
    }, [containerRef])

    return { isScrollingUp, setIsZooming }
}

/**
 * The props type for {@link PdfHighlighter}.
 *
 * @category Component Properties
 */
export interface PdfHighlighterProps {
    /**
     * Array of all highlights to be organised and fed through to the child
     * highlight container.
     */
    highlights: Array<Highlight>

    /**
     * Event is called only once whenever the user changes scroll after
     * the autoscroll function, scrollToHighlight, has been called.
     */
    onScrollAway?(): void

    onPageChange: (pageNumber: number) => void

    /**
     * What scale to render the PDF at inside the viewer.
     */
    pdfScaleValue?: PdfScaleValue

    /**
     * Callback triggered whenever a user finishes making a mouse selection or has
     * selected text.
     *
     * @param PdfSelection - Content and positioning of the selection. NOTE:
     * `makeGhostHighlight` will not work if the selection disappears.
     */
    onSelection?(PdfSelection: PdfSelection): void

    /**
     * Callback triggered whenever a ghost (non-permanent) highlight is created.
     *
     * @param ghostHighlight - Ghost Highlight that has been created.
     */
    onCreateGhostHighlight?(ghostHighlight: GhostHighlight): void

    /**
     * Callback triggered whenever a ghost (non-permanent) highlight is removed.
     *
     * @param ghostHighlight - Ghost Highlight that has been removed.
     */
    onRemoveGhostHighlight?(ghostHighlight: GhostHighlight): void

    /**
     * Optional element that can be displayed as a tip whenever a user makes a
     * selection.
     */
    selectionTip?: ReactNode

    /**
     * Condition to check before any mouse selection starts.
     *
     * @param event - mouse event associated with the new selection.
     * @returns - `True` if mouse selection should start.
     */
    enableAreaSelection?(event: MouseEvent): boolean

    /**
     * Optional CSS styling for the rectangular mouse selection.
     */
    mouseSelectionStyle?: CSSProperties

    /**
     * PDF document to view and overlay highlights.
     */
    pdfDocument: PDFDocumentProxy

    /**
     * This should be a highlight container/renderer of some sorts. It will be
     * given appropriate context for a single highlight which it can then use to
     * render a TextHighlight, AreaHighlight, etc. in the correct place.
     */
    children: ReactNode

    /**
     * Coloring for unhighlighted, selected text.
     */
    textSelectionColor?: string

    startPage?: number

    /**
     * Creates a reference to the PdfHighlighterContext above the component.
     *
     * @param pdfHighlighterUtils - various useful tools with a PdfHighlighter.
     * See {@link PdfHighlighterContext} for more description.
     */
    utilsRef(pdfHighlighterUtils: PdfHighlighterUtils): void

    /**
     * Style properties for the PdfHighlighter (scrollbar, background, etc.), NOT
     * the PDF.js viewer it encloses. If you want to edit the latter, use the
     * other style props like `textSelectionColor` or overwrite pdf_viewer.css
     */
    style?: CSSProperties

    onTotalPagesChange(pages: number): void

    bookId: string
    bookTitle: string
}

// Language Popover component
const LanguagePopover: React.FC<{
    language: string
    onLanguageChange: (value: string) => void
}> = ({ language, onLanguageChange }) => (
    <Popover>
        <PopoverTrigger asChild>
            <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 data-[state=open]:bg-accent"
            >
                <Globe className="h-4 w-4" />
            </Button>
        </PopoverTrigger>
        <PopoverContent
            className="w-60 overflow-hidden rounded-lg p-4"
            align="end"
        >
            <div className="space-y-4">
                <h3 className="font-medium">AI Language</h3>
                <Select value={language} onValueChange={onLanguageChange}>
                    <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                        {LANGUAGE_OPTIONS.map(({ value, label }) => (
                            <SelectItem
                                key={value}
                                value={value}
                                className="cursor-pointer"
                            >
                                {label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </PopoverContent>
    </Popover>
)

/**
 * This is a large-scale PDF viewer component designed to facilitate
 * highlighting. It should be used as a child to a {@link PdfLoader} to ensure
 * proper document loading. This does not itself render any highlights, but
 * instead its child should be the container component for each individual
 * highlight. This component will be provided appropriate HighlightContext for
 * rendering.
 *
 * @category Component
 */
export const PdfHighlighter = ({
    highlights,
    onScrollAway,
    onSelection: onSelectionFinished,
    onCreateGhostHighlight,
    onRemoveGhostHighlight,
    selectionTip,
    enableAreaSelection,
    mouseSelectionStyle,
    pdfDocument,
    children,
    textSelectionColor = DEFAULT_TEXT_SELECTION_COLOR,
    utilsRef,
    style,
    onPageChange,
    startPage,
    onTotalPagesChange,
    bookId,
    bookTitle,
    pdfScaleValue,
}: PdfHighlighterProps) => {
    const setProgressPercentage = useReaderStore(
        (state) => state.setProgressPercentage
    )
    const setTotalPages = useReaderStore((state) => state.setTotalPages)
    const goToPage = useReaderStore((state) => state.goToPage)
    const activeAIAction = useReaderStore((state) => state.activeAIAction)
    const isAreaSelectionActive = useReaderStore(
        (state) => state.isAreaSelectionActive
    )
    const bookMeta = useReaderStore((state) => state.bookMeta)

    // Language state
    const bookLanguage = bookMeta?.language || "English (en)"
    const [language, setLanguage] = useState(bookLanguage)

    // Handle language change
    const handleLanguageChange = async (value: string) => {
        setLanguage(value)
        if (bookId) {
            await updateBookLanguage(bookId, value)
        }
    }

    // State
    const [tip, setTip] = useState<Tip | null>(null)
    const [isViewerReady, setIsViewerReady] = useState(false)
    const initialPageSetRef = useRef(false)
    const startPageRef = useRef(startPage)
    const setPdfRef = useReaderStore((state) => state.setPdfRef)

    // Refs
    const containerNodeRef = useRef<HTMLDivElement | null>(null)
    const { isScrollingUp, setIsZooming } = useScrollDirection(containerNodeRef)
    const highlightBindingsRef = useRef<{ [page: number]: HighlightBindings }>(
        {}
    )
    const ghostHighlightRef = useRef<GhostHighlight | null>(null)
    const selectionRef = useRef<PdfSelection | null>(null)
    const scrolledToHighlightIdRef = useRef<string | null>(null)
    const isAreaSelectionInProgressRef = useRef(false)
    const isEditInProgressRef = useRef(false)
    const updateTipPositionRef = useRef(() => {})

    const eventBusRef = useRef<InstanceType<typeof EventBus>>(new EventBus())
    const linkServiceRef = useRef<InstanceType<typeof PDFLinkService>>(
        new PDFLinkService({
            eventBus: eventBusRef.current,
            externalLinkTarget: 2,
        })
    )
    const resizeObserverRef = useRef<ResizeObserver | null>(null)
    const viewerRef = useRef<InstanceType<typeof PDFViewer> | null>(null)

    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const [currentPage, setCurrentPage] = useState<number | undefined>(
        startPage
    )
    const { open, setOpen } = useSidebarRight()

    const [showHeader, setShowHeader] = useState(true)
    const headerRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            const isNearTop = e.clientY < 48
            let isOverHeader = false
            if (headerRef.current) {
                const rect = headerRef.current.getBoundingClientRect()
                isOverHeader =
                    e.clientY >= rect.top &&
                    e.clientY <= rect.bottom &&
                    e.clientX >= rect.left &&
                    e.clientX <= rect.right
            }
            setShowHeader(isNearTop || isOverHeader)
        }
        window.addEventListener("mousemove", handleMouseMove)
        return () => window.removeEventListener("mousemove", handleMouseMove)
    }, [])

    useEffect(() => {
        startPageRef.current = startPage
    }, [startPage])

    // Initialise PDF Viewer
    useLayoutEffect(() => {
        if (!containerNodeRef.current) return

        const debouncedDocumentInit = debounce(() => {
            viewerRef.current =
                viewerRef.current ||
                new PDFViewer({
                    container: containerNodeRef.current!,
                    eventBus: eventBusRef.current,
                    textLayerMode: 2,
                    removePageBorders: true,
                    linkService: linkServiceRef.current,
                })
            viewerRef.current.setDocument(pdfDocument)
            linkServiceRef.current.setDocument(pdfDocument)
            linkServiceRef.current.setViewer(viewerRef.current)
            setPdfRef(viewerRef)
            setIsViewerReady(true)

            // Apply initial zoom if provided
            if (pdfScaleValue && viewerRef.current) {
                ;`Setting initial zoom to ${pdfScaleValue} during initialization`
                viewerRef.current.currentScaleValue = pdfScaleValue.toString()
            }
        }, 100)

        debouncedDocumentInit()

        return () => {
            debouncedDocumentInit.cancel()
        }
    }, [document, pdfDocument, pdfScaleValue])

    // Set initial page when viewer is ready
    useEffect(() => {
        if (!isViewerReady || !viewerRef.current) return

        const checkAndSetInitialPage = () => {
            if (
                !viewerRef.current ||
                !pdfDocument ||
                !pdfDocument.numPages ||
                !startPage
            )
                return
            if (initialPageSetRef.current) return

            setTimeout(() => {
                if (viewerRef.current) {
                    initialPageSetRef.current = true
                    viewerRef.current.currentPageNumber = Number(startPage)
                    initialPageSetRef.current = true

                    // Apply initial zoom when the viewer is ready
                    if (
                        pdfScaleValue &&
                        pdfScaleValue?.toString() !== "[object Object]"
                    ) {
                        viewerRef.current.currentScaleValue =
                            pdfScaleValue.toString()
                    }
                }
            }, 100)
        }

        // Listen for the 'pagesloaded' event which indicates the PDF is fully loaded
        const onPagesLoaded = () => {
            checkAndSetInitialPage()
        }

        const onPagesInit = () => {
            // Wait a bit longer for pagesinit since the document might not be fully ready
            setTimeout(checkAndSetInitialPage, 200)
        }

        eventBusRef.current.on("pagesloaded", onPagesLoaded)
        eventBusRef.current.on("pagesinit", onPagesInit)

        // Also try to set it now in case the pages are already loaded
        setTimeout(checkAndSetInitialPage, 300)
        setTotalPages(pdfDocument.numPages)
        onTotalPagesChange(pdfDocument.numPages)

        return () => {
            eventBusRef.current.off("pagesloaded", onPagesLoaded)
            eventBusRef.current.off("pagesinit", onPagesInit)
        }
    }, [isViewerReady, pdfDocument, pdfScaleValue])

    // Initialise viewer event listeners
    useLayoutEffect(() => {
        if (!containerNodeRef.current) return

        const doc = containerNodeRef.current.ownerDocument

        eventBusRef.current.on("textlayerrendered", renderHighlightLayers)
        eventBusRef.current.on("pagesinit", handleScaleValue)
        doc.addEventListener("keydown", handleKeyDown)

        renderHighlightLayers()

        return () => {
            eventBusRef.current.off("pagesinit", handleScaleValue)
            eventBusRef.current.off("textlayerrendered", renderHighlightLayers)
            doc.removeEventListener("keydown", handleKeyDown)
            resizeObserverRef.current?.disconnect()
        }
    }, [selectionTip, highlights, onSelectionFinished])

    useEffect(() => {
        const viewer = viewerRef.current
        if (!viewer || !onPageChange) return

        const handlePageChange = (e: { pageNumber: number }) => {
            setProgressPercentage(100 * (e.pageNumber / pdfDocument.numPages))
            setCurrentPage(e.pageNumber)
            onPageChange(e.pageNumber)
        }

        viewer.eventBus.on("pagechanging", handlePageChange)

        // Initial page report
        onPageChange(viewer.currentPageNumber)

        return () => {
            viewer.eventBus.off("pagechanging", handlePageChange)
        }
    }, [viewerRef.current, onPageChange])

    // Event listeners
    const handleScroll = () => {
        if (onScrollAway) onScrollAway()
        scrolledToHighlightIdRef.current = null
        renderHighlightLayers()
    }

    const handleMouseUp: PointerEventHandler = () => {
        const container = containerNodeRef.current
        const selection = getWindow(container).getSelection()

        if (
            !container ||
            !selection ||
            selection.isCollapsed ||
            !viewerRef.current
        )
            return

        const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null

        // Check the selected text is in the document, not the tip
        if (!range || !container.contains(range.commonAncestorContainer)) return

        const pages = getPagesFromRange(range)
        if (!pages || pages.length === 0) return

        const rects = getClientRects(range, pages)
        if (rects.length === 0) return

        const viewportPosition: ViewportPosition = {
            boundingRect: getBoundingRect(rects),
            rects,
        }

        const scaledPosition = viewportPositionToScaled(
            viewportPosition,
            viewerRef.current
        )

        const content: Content = {
            text: selection.toString().split("\n").join(" "), // Make all line breaks spaces
        }

        // Enable keyboard shortcuts for copy (Ctrl+C/Cmd+C)
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "c") {
                e.preventDefault()
                const selectedText = selection.toString()
                if (selectedText) {
                    navigator.clipboard
                        .writeText(selectedText)
                        .catch((err) =>
                            console.error("Failed to copy text: ", err)
                        )
                }
            }
        }

        // Add temporary event listener for copy operation
        document.addEventListener("keydown", handleKeyDown)

        // Remove the listener when selection changes or is cleared
        const handleSelectionChange = () => {
            document.removeEventListener("keydown", handleKeyDown)
            document.removeEventListener(
                "selectionchange",
                handleSelectionChange
            )
        }

        document.addEventListener("selectionchange", handleSelectionChange)

        selectionRef.current = {
            content,
            type: "text",
            position: scaledPosition,
            makeGhostHighlight: () => {
                ghostHighlightRef.current = {
                    content: content,
                    type: "text",
                    position: scaledPosition,
                }

                if (onCreateGhostHighlight)
                    onCreateGhostHighlight(ghostHighlightRef.current)
                clearTextSelection()
                renderHighlightLayers()
                return ghostHighlightRef.current
            },
        }

        if (onSelectionFinished) onSelectionFinished(selectionRef.current)

        // Only show the tip if there's no active AI action
        if (selectionTip)
            setTip({ position: viewportPosition, content: selectionTip })
    }

    const handleMouseDown: PointerEventHandler = (event) => {
        // Skip action on right click to allow context menu
        if (event.button === 2) {
            // Allow default browser behavior for right-click
            return
        }

        if (
            !isHTMLElement(event.target) ||
            asElement(event.target).closest(".PdfHighlighter__tip-container") // Ignore selections on tip container
        ) {
            return
        }

        setTip(null)
        clearTextSelection() // TODO: Check if clearing text selection only if not clicking on tip breaks anything.
        removeGhostHighlight()
        toggleEditInProgress(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.code === "Escape") {
            clearTextSelection()
            removeGhostHighlight()
            setTip(null)
        }
    }

    const handleScaleValue = (zoom: number | string) => {
        const zoomValue = zoom.toString()

        if (viewerRef.current && zoomValue !== "[object Object]") {
            // Set zooming flag to prevent header from hiding
            setIsZooming(true)
            viewerRef.current.currentScaleValue = zoomValue
            // Reset zooming flag after a short delay
            setTimeout(() => {
                setIsZooming(false)
            }, 300)
        }
    }

    // Render Highlight layers
    const renderHighlightLayer = (
        highlightBindings: HighlightBindings,
        pageNumber: number
    ) => {
        if (!viewerRef.current) return

        highlightBindings.reactRoot.render(
            <PdfHighlighterContext.Provider value={pdfHighlighterUtils}>
                <HighlightLayer
                    highlightsByPage={groupHighlightsByPage([
                        ...highlights,
                        ghostHighlightRef.current,
                    ])}
                    pageNumber={pageNumber}
                    scrolledToHighlightId={scrolledToHighlightIdRef.current}
                    viewer={viewerRef.current}
                    highlightBindings={highlightBindings}
                >
                    {children}
                </HighlightLayer>
            </PdfHighlighterContext.Provider>
        )
    }

    const renderHighlightLayers = () => {
        if (!viewerRef.current) return

        for (
            let pageNumber = 1;
            pageNumber <= pdfDocument.numPages;
            pageNumber++
        ) {
            const highlightBindings = highlightBindingsRef.current[pageNumber]

            // Need to check if container is still attached to the DOM as PDF.js can unload pages.
            if (highlightBindings?.container?.isConnected) {
                renderHighlightLayer(highlightBindings, pageNumber)
            } else {
                const pageView = viewerRef.current!.getPageView(pageNumber - 1)
                if (!pageView) continue
                const { textLayer } =
                    viewerRef.current!.getPageView(pageNumber - 1) || {}
                if (!textLayer) continue // Viewer hasn't rendered page yet

                const textLayerDiv = textLayer.div || textLayer.textLayerDiv
                if (!textLayerDiv) continue

                // textLayer.div for version >=3.0 and textLayer.textLayerDiv otherwise.
                const highlightLayer = findOrCreateHighlightLayer(textLayer.div)

                if (highlightLayer) {
                    const reactRoot = createRoot(highlightLayer)
                    highlightBindingsRef.current[pageNumber] = {
                        reactRoot,
                        container: highlightLayer,
                        textLayer: textLayer.div, // textLayer.div for version >=3.0 and textLayer.textLayerDiv otherwise.
                    }

                    renderHighlightLayer(
                        highlightBindingsRef.current[pageNumber],
                        pageNumber
                    )
                }
            }
        }
    }

    // Utils
    const isEditingOrHighlighting = () => {
        return (
            Boolean(selectionRef.current) ||
            Boolean(ghostHighlightRef.current) ||
            isAreaSelectionInProgressRef.current ||
            isEditInProgressRef.current
        )
    }

    const toggleEditInProgress = (flag?: boolean) => {
        if (flag !== undefined) {
            isEditInProgressRef.current = flag
        } else {
            isEditInProgressRef.current = !isEditInProgressRef.current
        }

        // Disable text selection
        if (viewerRef.current)
            viewerRef.current.viewer?.classList.toggle(
                "PdfHighlighter--disable-selection",
                isEditInProgressRef.current
            )
    }

    const removeGhostHighlight = () => {
        if (onRemoveGhostHighlight && ghostHighlightRef.current)
            onRemoveGhostHighlight(ghostHighlightRef.current)
        ghostHighlightRef.current = null
        renderHighlightLayers()
    }

    const clearTextSelection = () => {
        selectionRef.current = null

        const container = containerNodeRef.current
        const selection = getWindow(container).getSelection()
        if (!container || !selection) return
        selection.removeAllRanges()
    }

    const scrollToHighlight = (highlight: Highlight) => {
        const { boundingRect, usePdfCoordinates } = highlight.position
        const pageNumber = Number(boundingRect.pageNumber)

        // Remove scroll listener in case user auto-scrolls in succession.
        viewerRef.current!.container.removeEventListener("scroll", handleScroll)

        const pageViewport = viewerRef.current!.getPageView(
            pageNumber - 1
        ).viewport

        viewerRef.current!.scrollPageIntoView({
            pageNumber,
            destArray: [
                null, // null since we pass pageNumber already as an arg
                { name: "XYZ" },
                ...pageViewport.convertToPdfPoint(
                    0, // Default x coord
                    scaledToViewport(
                        boundingRect,
                        pageViewport,
                        usePdfCoordinates
                    ).top - SCROLL_MARGIN
                ),
                0, // Default z coord
            ],
        })

        scrolledToHighlightIdRef.current = highlight.id
        renderHighlightLayers()

        // wait for scrolling to finish
        setTimeout(() => {
            viewerRef.current!.container.addEventListener(
                "scroll",
                handleScroll,
                {
                    once: true,
                }
            )
        }, 100)
    }

    const pdfHighlighterUtils: PdfHighlighterUtils = {
        isEditingOrHighlighting,
        getScrollContainer: () => scrollContainerRef.current,
        getCurrentSelection: () => selectionRef.current,
        getGhostHighlight: () => ghostHighlightRef.current,
        removeGhostHighlight,
        toggleEditInProgress,
        isEditInProgress: () => isEditInProgressRef.current,
        isSelectionInProgress: () =>
            Boolean(selectionRef.current) ||
            isAreaSelectionInProgressRef.current,
        scrollToHighlight,
        getViewer: () => viewerRef.current,
        getTip: () => tip,
        setTip,
        updateTipPosition: updateTipPositionRef.current,
        scrollToPage: (page: number) => {
            goToPage(Number(page))
        },
    }

    utilsRef(pdfHighlighterUtils)

    // Remove this effect since we're using CSS classes now
    /*
    useEffect(() => {
        if (!containerNodeRef.current) return
        
        if (isAreaSelectionActive) {
            containerNodeRef.current.style.cursor = 'crosshair'
        } else {
            containerNodeRef.current.style.cursor = 'inherit'
        }
    }, [isAreaSelectionActive])
    */

    const isMobile = useIsMobile()

    return (
        <div>
            <div className="flex">
                <div ref={headerRef} className="flex-1 w-full">
                    <Header
                        classAttributes={`sticky top-0 z-2 bg-background border-b shadow-sm transition-all duration-200 ${isScrollingUp || showHeader ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"} ${open ? "w-full" : "w-full"}`}
                        breadcrumbItems={
                            isMobile
                                ? []
                                : [
                                      { href: "/library", label: "Home" },
                                      {
                                          href: `/library/${bookId}`,
                                          label:
                                              bookTitle.length > 30
                                                  ? `${bookTitle.substring(0, 30)}...`
                                                  : bookTitle,
                                      },
                                  ]
                        }
                    >
                        <div className="flex items-center gap-2">
                            <PdfZoom
                                onZoomChange={(zoom) => handleScaleValue(zoom)}
                            />
                            <PageNumberInput onPageChange={goToPage} />
                            <LanguagePopover
                                language={language}
                                onLanguageChange={handleLanguageChange}
                            />
                            <SidebarRightTrigger />
                        </div>
                    </Header>
                </div>
                <ReadingProgressBar />

                <PdfHighlighterContext.Provider value={pdfHighlighterUtils}>
                    <div
                        ref={containerNodeRef}
                        className={`PdfContainer ${open ? "w-full" : "w-full"} transition-all duration-200 z-1 ${isAreaSelectionActive ? "area-selection-active" : ""}`}
                        onPointerDown={handleMouseDown}
                        onPointerUp={handleMouseUp}
                        style={style}
                    >
                        <div className="pdfViewer" />
                        <style>
                            {`
                                    .textLayer ::selection {
                                        background: ${textSelectionColor};
                                    }
                                    
                                `}
                        </style>
                        {isViewerReady && (
                            <TipContainer
                                viewer={viewerRef.current!}
                                updateTipPositionRef={updateTipPositionRef}
                            />
                        )}
                        {isViewerReady && enableAreaSelection && (
                            <MouseSelection
                                viewer={viewerRef.current!}
                                onChange={(isVisible) =>
                                    (isAreaSelectionInProgressRef.current =
                                        isVisible)
                                }
                                enableAreaSelection={enableAreaSelection}
                                style={mouseSelectionStyle}
                                onDragStart={() =>
                                    disableTextSelection(
                                        viewerRef.current!,
                                        true
                                    )
                                }
                                onReset={() => {
                                    selectionRef.current = null
                                    disableTextSelection(
                                        viewerRef.current!,
                                        false
                                    )
                                }}
                                onSelection={(
                                    viewportPosition,
                                    scaledPosition,
                                    image,
                                    resetSelection
                                ) => {
                                    selectionRef.current = {
                                        content: { image },
                                        type: "area",
                                        position: scaledPosition,
                                        makeGhostHighlight: () => {
                                            ghostHighlightRef.current = {
                                                position: scaledPosition,
                                                type: "area",
                                                content: { image },
                                            }
                                            if (onCreateGhostHighlight)
                                                onCreateGhostHighlight(
                                                    ghostHighlightRef.current
                                                )
                                            resetSelection()
                                            renderHighlightLayers()
                                            return ghostHighlightRef.current
                                        },
                                    }

                                    if (onSelectionFinished)
                                        onSelectionFinished(
                                            selectionRef.current
                                        )
                                    if (selectionTip)
                                        setTip({
                                            position: viewportPosition,
                                            content: selectionTip,
                                        })
                                }}
                            />
                        )}
                    </div>
                </PdfHighlighterContext.Provider>
            </div>
        </div>
    )
}
