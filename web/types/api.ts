import { SerializedRange } from "./library"

export interface Book {
    id: string
    user_id: string
    title: string
    author?: string
    description?: string
    cover_url?: string
    file_url: string
    file_type: string
    language?: string
    total_pages?: number
    current_page?: number
    epub_progress?: Record<string, unknown>
    pdf_page?: number
    last_recall_page?: number
    date_added: string
    last_modified: string
}

export interface BookCreate {
    user_id: string
    title: string
    author?: string
    description?: string
    cover_url?: string | null
    file_url: string | null
    file_type: string
    language?: string
    total_pages?: number
    current_page?: number
    epub_progress?: Record<string, unknown>
    pdf_page?: number
    last_recall_page?: number
    goals?: string | null
    rag_enabled?: boolean
}

export interface BookUpdate {
    title?: string | null
    author?: string | null
    description?: string | null
    cover_url?: string | null
    file_url?: string | null
    file_type?: string | null
    language?: string | null
    total_pages?: number | null
    current_page?: number | null
    epub_progress?: Record<string, unknown> | null
    pdf_page?: number | null
    last_recall_page?: number | null
    goals?: string | null
}

export interface BookProgress {
    current_page?: number
    epub_progress?: Record<string, unknown>
    pdf_page?: number
}

export interface Highlight {
    id: string
    book_id: string
    text: string
    color?: string
    note?: string
    epub_range?: SerializedRange
    epub_chapter_href?: string
    epub_chapter_idx?: number
    epub_chapter_title?: string
    epub_est_page?: number
    pdf_rect_position?: Record<string, unknown>
    created_at: string
    updated_at: string
}

export interface HighlightCreate {
    book_id: string
    text: string
    color?: string
    note?: string
    epub_range?: SerializedRange
    epub_chapter_href?: string
    epub_chapter_idx?: number
    epub_chapter_title?: string
    epub_est_page?: number
    pdf_rect_position?: Record<string, unknown>
}

export interface HighlightUpdate {
    text?: string
    color?: string
    note?: string
    epub_range?: SerializedRange
    epub_chapter_href?: string
    epub_chapter_idx?: number
    epub_chapter_title?: string
    epub_est_page?: number
    pdf_rect_position?: Record<string, unknown>
}
