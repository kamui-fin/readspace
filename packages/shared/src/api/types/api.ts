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