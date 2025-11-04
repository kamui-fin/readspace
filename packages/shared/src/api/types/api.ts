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
export interface ApiErrorData {
  message?: string;
  detail?: string;
  response?: {
    data?: {
      detail?: string;
      message?: string;
    };
  };
}

// Mutation Response Types
export interface MutationResponse<T = unknown> {
  data?: T;
  error?: string;
  success: boolean;
}

// Function Parameter Types
export interface UpdateProgressParams {
  bookId: string;
  page: number;
}

export interface AddHighlightParams {
  user_book_lib_id: string;
  original_text: string;
  color: "YELLOW" | "GREEN" | "BLUE" | "PINK" | "PURPLE";
  note?: string | null;
  html_range?: import("./books").SerializedRangeJson | null;
  chapter_idx?: number | null;
  chapter_href?: string | null;
  chapter_title?: string | null;
  page?: number | null;
  pdf_rect_position?: Record<string, unknown> | null;
}

export interface DeleteHighlightParams {
  text: string;
}

export interface AddAnnotationParams {
  note: string;
  text: string;
}
