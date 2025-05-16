import { Tables } from "@/database.types"
import { GhostHighlight, ScaledPosition } from "react-pdf-highlighter-extended"

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

// Map Supabase book_metadata table to BookMeta type
export type BookMeta = Tables<"book_metadata"> & {
    type: "epub" | "pdf"
    epub_progress?: EpubLocation | null
    pdf_page?: number | null
    pdf_toc?: any | null
    epub_chapter_char_counts?: number[] | null
    language?: string | null
    num_pages?: number | null
    date_added?: string | null
}

export type BookCreate = Omit<BookMeta, "id" | "created_at" | "updated_at">

export type BookFormat = "epub" | "pdf"

export type HighlightLocation = Tables<"highlight_locations">

export type UserBookLibrary = Tables<"user_book_library">

export type Profile = Tables<"profiles">
