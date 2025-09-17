import { Database } from "../database.types"

type Tables = Database["public"]["Tables"]
type Enums = Database["public"]["Enums"]

// Book types
export type BookFormat = Enums["bookformat"]
export type HighlightColor = Enums["highlightcolor"]

// Base types from database
export type BookMetadata = Database["public"]["Tables"]["book_metadata"]["Row"]
export type UserBookLibrary =
    Database["public"]["Tables"]["user_book_library"]["Row"] & {
        book_metadata: BookMetadata
    }
export type Highlight = Database["public"]["Tables"]["highlights"]["Row"]
export type Profile = Database["public"]["Tables"]["profiles"]["Row"]

// Create types
export type BookMetadataCreate = Omit<
    BookMetadata,
    "id" | "created_at" | "updated_at"
>
export type UserBookLibraryCreate = Omit<
    UserBookLibrary,
    "id" | "date_added" | "book_metadata"
>
export type HighlightCreate = Omit<Highlight, "id">

// Update types
export type BookMetadataUpdate = Partial<
    Omit<BookMetadata, "id" | "created_at" | "updated_at">
>
export type UserBookLibraryUpdate = Partial<
    Pick<UserBookLibrary, "epub_progress" | "pdf_current_page">
>
export type HighlightUpdate = Partial<Pick<Highlight, "color" | "note">>

// Progress types
export interface EpubProgress {
    globalProgress: {
        current: number
        total: number
    }
    loc?: string
}

// Extended types for frontend
export type BookViewProps = BookMetadata & {
    library_id?: string | null
    pdf_current_page?: number | null
    epub_progress?: EpubProgress | null
}

// ========= API Response Types =========
export interface PaginatedResponse<T> {
    items: T[]
    total: number
    page: number
    size: number
    pages: number
}

export interface ApiPaginatedResponse<T> {
    articles?: T[]
    items?: T[]
    total: number
    page: number
    size: number
    pages?: number
    total_pages?: number
}

// ========= User Book Library API Types =========
export interface UserBookLibraryProgressResponse {
    id: string
    user_id: string
    book_metadata_id: string
    pdf_current_page?: number
    epub_progress?: EpubProgress
    date_added: string
    book_metadata: BookMetadata
}

// ========= Highlight API Types =========
export interface HighlightCreateRequest {
    user_book_lib_id: string
    original_text: string
    color: HighlightColor
    note?: string | null
    html_range?: Record<string, unknown> | null
    chapter_idx?: number | null
    chapter_href?: string | null
    chapter_title?: string | null
    page?: number | null
    pdf_rect_position?: Record<string, unknown> | null
}

export interface HighlightUpdateRequest {
    note: string
    text: string
}

// ========= PDF.js Related Types =========
export interface PdfDocumentProxy {
    numPages: number
    fingerprint: string
    [key: string]: unknown
}

// React-pdf-highlighter-extended types
export interface PdfHighlightPosition {
    boundingRect: {
        x1: number
        y1: number
        x2: number
        y2: number
        width: number
        height: number
    }
    rects: Array<{
        x1: number
        y1: number
        x2: number
        y2: number
        width: number
        height: number
    }>
    pageNumber: number
}

export interface PdfHighlightContent {
    text?: string
    image?: string
}

export interface PdfHighlight {
    id: string
    position: PdfHighlightPosition
    content: PdfHighlightContent
    color?: string
    note?: string
}

// ========= Mutation Response Types =========
export interface MutationResponse<T = unknown> {
    data?: T
    error?: string
    success: boolean
}

// ========= Generic API Error Type =========
export interface ApiError {
    message?: string
    detail?: string
    response?: {
        data?: {
            detail?: string
            message?: string
        }
    }
}

// ========= Function Parameter Types =========
export interface UpdateProgressParams {
    bookId: string
    page: number
}

export interface AddHighlightParams extends HighlightCreateRequest {}

export interface DeleteHighlightParams {
    text: string
}

export interface AddAnnotationParams {
    note: string
    text: string
}
