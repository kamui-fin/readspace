import { Database } from "../database.types"

type Tables = Database["public"]["Tables"]
type Enums = Database["public"]["Enums"]

// Book types
export type BookFormat = Enums["bookformat"]
export type HighlightColor = Enums["highlightcolor"]

export interface EpubProgress {
    globalProgress: {
        current: number
        total: number
    }
    loc?: string
}

export interface BookMetadata {
    id: string
    title: string
    author?: string | null
    description?: string | null
    cover_url?: string | null
    file_url?: string | null
    format: BookFormat
    num_pages?: number | null
    file_size_bytes?: number | null
    epub_chapter_char_counts?: number[] | null
    epub_page_char_counts?: number[] | null
    pdf_toc?: Record<string, unknown> | null
    created_at: string
    updated_at: string
}

export interface BookMetadataCreate {
    title: string
    author?: string | null
    description?: string | null
    cover_url?: string | null
    file_url?: string | null
    format: BookFormat
    num_pages?: number | null
    file_size_bytes?: number | null
    epub_chapter_char_counts?: number[] | null
    epub_page_char_counts?: number[] | null
    pdf_toc?: Record<string, unknown> | null
}

export interface BookMetadataUpdate {
    title?: string | null
    author?: string | null
    description?: string | null
    cover_url?: string | null
    file_url?: string | null
    format?: BookFormat | null
    num_pages?: number | null
    file_size_bytes?: number | null
    epub_chapter_char_counts?: number[] | null
    epub_page_char_counts?: number[] | null
    pdf_toc?: Record<string, unknown> | null
}

export interface UserBookLibrary {
    id: string
    user_id: string
    book_metadata_id: string
    date_added: string
    epub_progress?: EpubProgress | null
    pdf_current_page?: number | null
    book_metadata: BookMetadata
}

export interface UserBookLibraryCreate {
    user_id: string
    book_metadata_id: string
    epub_progress?: EpubProgress | null
    pdf_current_page?: number | null
}

export interface UserBookLibraryUpdate {
    epub_progress?: EpubProgress | null
    pdf_current_page?: number | null
}

// Highlight types
export interface Highlight {
    id: string
    user_book_lib_id: string
    color: HighlightColor
    original_text: string
    note?: string | null
    created_at: string
    updated_at: string
    locations: HighlightLocation[]
}

export interface HighlightCreate {
    user_book_lib_id: string
    color: HighlightColor
    original_text: string
    note?: string | null
    locations: Omit<HighlightLocationCreate, "highlight_id">[]
}

export interface HighlightUpdate {
    color?: HighlightColor
    note?: string | null
}

export interface HighlightLocation {
    id: string
    highlight_id: string
    chapter_idx?: number | null
    chapter_href?: string | null
    chapter_title?: string | null
    page?: number | null
    html_range?: Record<string, unknown> | null
    pdf_rect_position?: Record<string, unknown> | null
    created_at: string
}

export interface HighlightLocationCreate {
    highlight_id: string
    chapter_idx?: number | null
    chapter_href?: string | null
    chapter_title?: string | null
    page?: number | null
    html_range?: Record<string, unknown> | null
    pdf_rect_position?: Record<string, unknown> | null
}
