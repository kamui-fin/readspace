import { Tables } from "@/database.types"
import { GhostHighlight, ScaledPosition } from "react-pdf-highlighter-extended"

// Define zoom value type for PDF viewer
export type ZoomValue =
    | number
    | "auto"
    | "page-fit"
    | "page-width"
    | "page-actual"
    | "page-height"

export type Measurable = {
    getBoundingClientRect(): DOMRect
}

export type RangeRefElement = {
    className?: string
    getBoundingClientRect: () => DOMRect
}

export interface SerializedRange {
    startContainerPath: number[]
    startOffset: number
    endContainerPath: number[]
    endOffset: number
}

export interface EpubHighlight {
    range: SerializedRange
    color: "yellow" | "blue" | "green"
    text: string
    note: string | null
    book_id: string
    chapter: {
        idx: number
        href: string
        title?: string
    }
    page: number
}

export interface HighlightState {
    highlight: Highlight
    removeFn: () => void
}

export type CharacterProgress = {
    current: number
    total: number
}

export interface EpubLocation {
    loc?: string
    scrollElement?: string
    globalProgress: CharacterProgress
}

export interface PdfHighlight extends GhostHighlight {
    id: string
    note?: string
    color?: string
    book_id: string
    type: "text"
    position: ScaledPosition
}

export type Highlight = EpubHighlight | PdfHighlight

// Map Supabase book table to BookMeta type
export type BookMeta = Tables<"books"> & {
    // Type information for epub_progress
    epub_progress: EpubLocation
    // Add proper typing for EPUB-specific fields
    epub_chapter_char_counts?: number[]
}
