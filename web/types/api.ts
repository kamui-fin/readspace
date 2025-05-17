import { Database } from "../database.types"

type Tables = Database["public"]["Tables"]
type Enums = Database["public"]["Enums"]

// Book types
export type BookFormat = Enums["bookformat"]
export type HighlightColor = Enums["highlightcolor"]

// Base types from database
export type BookMetadata = Database["public"]["Tables"]["book_metadata"]["Row"]
export type UserBookLibrary = Database["public"]["Tables"]["user_book_library"]["Row"] & {
    book_metadata: BookMetadata
}
export type Highlight = Database["public"]["Tables"]["highlights"]["Row"]
export type HighlightLocation = Database["public"]["Tables"]["highlight_locations"]["Row"]

// Create types
export type BookMetadataCreate = Omit<BookMetadata, "id" | "created_at" | "updated_at">
export type UserBookLibraryCreate = Omit<UserBookLibrary, "id" | "date_added" | "book_metadata">
export type HighlightCreate = Omit<Highlight, "id" | "created_at" | "updated_at"> & {
    locations: Omit<HighlightLocation, "id" | "created_at" | "highlight_id">[]
}

// Update types
export type BookMetadataUpdate = Partial<Omit<BookMetadata, "id" | "created_at" | "updated_at">>
export type UserBookLibraryUpdate = Partial<Pick<UserBookLibrary, "epub_progress" | "pdf_current_page">>
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
