// Book types aligned with backend schema and database
export type BookFormat = "PDF" | "EPUB";
export type HighlightColor = "YELLOW" | "GREEN" | "BLUE" | "PINK" | "PURPLE";

// Base types matching database schema
export type BookMetadata = {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  cover_url: string | null; // Matches backend and database field name
  format: BookFormat;
  file_url: string; // Matches backend and database field name
  file_size_bytes: number | null; // Matches backend and database field name
  num_pages: number | null; // Matches backend and database field name
  pdf_toc: unknown | null; // JSON type from database
  epub_chapter_char_counts: number[] | null; // Matches backend and database
  epub_page_char_counts: number[] | null; // Matches backend and database
  created_at: string;
};

export type UserBookLibrary = {
  id: string;
  user_id: string;
  book_metadata_id: string;
  pdf_current_page: number | null;
  epub_progress: unknown | null; // JSON type from database
  date_added: string;
  book_metadata: BookMetadata;
};

export type Highlight = {
  id: string;
  user_book_lib_id: string;
  original_text: string;
  color: HighlightColor;
  note?: string | null;
  html_range?: SerializedRangeJson | null;
  chapter_idx?: number | null;
  chapter_href?: string | null;
  chapter_title?: string | null;
  page?: number | null;
  pdf_rect_position?: Record<string, unknown> | null;
};

// Create types
export type BookMetadataCreate = Omit<
  BookMetadata,
  "id" | "created_at" | "updated_at"
>;
export type UserBookLibraryCreate = Omit<
  UserBookLibrary,
  "id" | "date_added" | "book_metadata"
>;
export type HighlightCreate = Omit<Highlight, "id">;

// Update types
export type BookMetadataUpdate = Partial<
  Omit<BookMetadata, "id" | "created_at" | "updated_at">
>;
export type UserBookLibraryUpdate = Partial<
  Pick<UserBookLibrary, "epub_progress" | "pdf_current_page">
>;
export type HighlightUpdate = Partial<Pick<Highlight, "color" | "note">>;

// Progress types
export interface EpubProgress {
  globalProgress: {
    current: number;
    total: number;
  };
  loc?: string;
}

// Type guard for EpubProgress from JSON
export function isEpubProgress(progress: unknown): progress is EpubProgress {
  return (
    progress !== null &&
    typeof progress === "object" &&
    "globalProgress" in progress &&
    typeof progress.globalProgress === "object" &&
    progress.globalProgress !== null &&
    "current" in progress.globalProgress &&
    "total" in progress.globalProgress &&
    typeof progress.globalProgress.current === "number" &&
    typeof progress.globalProgress.total === "number"
  );
}

// Extended types for frontend use
export type UserBookLibraryWithTypedProgress = Omit<
  UserBookLibrary,
  "epub_progress"
> & {
  epub_progress: EpubProgress | null;
};

export type BookViewProps = BookMetadata & {
  library_id?: string | null;
  pdf_current_page?: number | null;
  epub_progress?: EpubProgress | null;
};

// User Book Library API Types
export interface UserBookLibraryProgressResponse {
  id: string;
  user_id: string;
  book_metadata_id: string;
  pdf_current_page?: number;
  epub_progress?: EpubProgress;
  date_added: string;
  book_metadata: BookMetadata;
}

// Highlight API Types
export interface HighlightCreateRequest {
  user_book_lib_id: string;
  original_text: string;
  color: HighlightColor;
  note?: string | null;
  html_range?: SerializedRangeJson | null;
  chapter_idx?: number | null;
  chapter_href?: string | null;
  chapter_title?: string | null;
  page?: number | null;
  pdf_rect_position?: Record<string, unknown> | null;
}

export interface HighlightUpdateRequest {
  note: string;
  text: string;
}

// PDF.js Related Types
export interface PdfDocumentProxy {
  numPages: number;
  fingerprint: string;
  [key: string]: unknown;
}

// EPUB highlight range serialization types
export interface SerializedRange {
  startContainerPath: number[];
  startOffset: number;
  endContainerPath: number[];
  endOffset: number;
}

// Helper type for converting SerializedRange to JSON
export interface SerializedRangeJson {
  startContainerPath: number[];
  startOffset: number;
  endContainerPath: number[];
  endOffset: number;
}

// Type guard for SerializedRange
export function isSerializedRange(obj: unknown): obj is SerializedRange {
  return (
    obj !== null &&
    typeof obj === "object" &&
    "startContainerPath" in obj &&
    "startOffset" in obj &&
    "endContainerPath" in obj &&
    "endOffset" in obj &&
    Array.isArray((obj as unknown as SerializedRange).startContainerPath) &&
    Array.isArray((obj as unknown as SerializedRange).endContainerPath) &&
    typeof (obj as unknown as SerializedRange).startOffset === "number" &&
    typeof (obj as unknown as SerializedRange).endOffset === "number"
  );
}

// Convert SerializedRange to JSON-safe format
export function serializeRangeToJson(
  range: SerializedRange,
): SerializedRangeJson {
  return {
    startContainerPath: range.startContainerPath,
    startOffset: range.startOffset,
    endContainerPath: range.endContainerPath,
    endOffset: range.endOffset,
  };
}

// React-pdf-highlighter-extended types
export interface PdfHighlightPosition {
  boundingRect: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    width: number;
    height: number;
  };
  rects: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    width: number;
    height: number;
  }>;
  pageNumber: number;
}

export interface PdfHighlightContent {
  text?: string;
  image?: string;
}

export interface PdfHighlight {
  id: string;
  position: PdfHighlightPosition;
  content: PdfHighlightContent;
  color?: string;
  note?: string;
}
