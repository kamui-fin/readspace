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
    library_id?: string
}

export interface PdfHighlight extends GhostHighlight {
    id: string
    note?: string
    color?: string
    book_id: string
    type: "text"
    position: ScaledPosition
    user_book_lib_id?: string
    library_id?: string
}

export type Highlight = EpubHighlight | PdfHighlight

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

export type BookMetadata = Tables<"book_metadata"> & {
}

export type UserLibraryBook = Tables<"user_book_library"> & {
    book_metadata: BookMetadata;
}

export type BookViewProps = BookMetadata & {
    library_id?: string | null;
    pdf_current_page?: number | null;
    epub_progress?: EpubLocation | null;
}

export type BookCreate = Omit<Tables<"book_metadata">, "id" | "created_at" | "updated_at">

export type BookFormat = "EPUB" | "PDF"

export type HighlightLocation = Tables<"highlight_locations">

export type Profile = Tables<"profiles">
