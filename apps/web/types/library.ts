import { Database } from "@/database.types"
import { GhostHighlight, ScaledPosition } from "react-pdf-highlighter-extended"
import { BookMetadata, Highlight, SerializedRange } from "@readspace/shared"

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

export interface EpubHighlight extends Highlight {
    range: SerializedRange
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

export type HighlightState = {
    highlight: EpubHighlight | PdfHighlight
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

export type BookViewProps = BookMetadata & {
    library_id?: string | null
    pdf_current_page?: number | null
    epub_progress?: EpubLocation | null
}

export type BookCreate = Omit<BookMetadata, "id" | "created_at" | "updated_at">
export type BookFormat = Database["public"]["Enums"]["bookformat"]
