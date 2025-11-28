// Base API response types

// Offset-based pagination (legacy, used by some endpoints)
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    size: number;
    pages: number;
}

export interface ApiPaginatedResponse<T> {
    articles?: T[];
    items?: T[];
    total: number;
    page: number;
    size: number;
    pages?: number;
    total_pages?: number;
}

// Cursor-based pagination (used by article endpoints)
export interface CursorPaginatedResponse<T> {
    items: T[];
    next_cursor: string | null;
    has_more: boolean;
    total_count: number | null;
}

// Generic API Error Type (interface for error objects)
// Generic API Error Type
export interface ApiErrorData {
    message: string;
    status?: number;
    detail?: string;
}

// Mutation Response Types
export interface MutationResponse<T = unknown> {
    data?: T;
    error?: string;
    success: boolean;
}
