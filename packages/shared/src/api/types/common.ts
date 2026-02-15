// Base API response types

// Offset-based pagination
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface ApiPaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages?: number;
}

// Cursor-based pagination
export interface CursorPaginatedResponse<T> {
  items: T[];
  next_cursor: string | null;
  has_more: boolean;
  total_count: number | null;
}

export interface MessageResponse {
  message: string;
}

export enum ImportStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
  UNKNOWN = "unknown",
}

export enum LanguageCode {
  EN = "en",
  ES = "es",
  FR = "fr",
  DE = "de",
  IT = "it",
  PT = "pt",
  RU = "ru",
  JA = "ja",
  KO = "ko",
  ZH = "zh",
  AR = "ar",
  HI = "hi",
  NL = "nl",
  SV = "sv",
  NO = "no",
  DA = "da",
  FI = "fi",
  PL = "pl",
  TR = "tr",
  TH = "th",
  VI = "vi",
}

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
