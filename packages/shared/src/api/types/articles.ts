import { PaginatedResponse } from "./common";

export type Priority = "HIGH" | "MEDIUM" | "LOW";

export enum ArticleFilterMode {
  AllArticles = "allArticles",
  RecentlyRead = "recentlyRead",
  ReadLater = "readLater",
  Today = "today",
}

export enum ContentView {
  Original = "original",
  Extracted = "extracted",
  Translated = "translated",
}

// ============= Core Types =============

/**
 * Lightweight article for lists - no heavy content
 */
export interface ArticleSummary {
  id: string;

  // Content fields
  title: string | null;
  link: string;
  description: string | null; // Truncated to ~300 chars
  image_url: string | null;
  author: string | null;
  estimated_read_time_minutes: number | null;
  source_domain: string | null;

  // User state
  is_read: boolean;
  is_saved: boolean;
  priority: Priority;
  user_note: string | null;
  read_at: string | null;

  // Feed context (denormalized, no nested object)
  feed_id: string | null;
  feed_title: string | null;
  feed_icon: string | null;
  published_at: string | null;

  // Metadata
  article_type?: "feed" | "clipped"; // Deprecated: use !feed_id to detect clipped
  created_at: string;
}

/**
 * Full article detail with content - for reader view
 */
export interface Article extends ArticleSummary {
  content: string | null; // Full HTML content
  description: string | null; // Full description (not truncated)

  // Auto-extraction fields (from backend service)
  extracted_content?: string | null;
  extracted_read_time?: number | null;
}

// ============= API Responses =============

export type ArticlesPaginatedResponse = PaginatedResponse<ArticleSummary>;

export interface ArticleCountsResponse {
  feed_counts: Record<string, number>;
  read_later: number;
  today: number;
}

export interface SaveArticleResponse {
  success: boolean;
  article_id: string;
}

export type CheckArticleSavedResponse =
  | {
      is_saved: true;
      article_id: string;
      title: string | null;
      note: string | null;
      priority: Priority | null;
      is_read: boolean;
      read_at: string | null;
    }
  | {
      is_saved: false;
      article_id: null;
    };

// ============= API Requests =============

export interface SaveArticleRequest {
  url: string;
  title?: string;
  content?: string;
  priority?: Priority;
  note?: string;
}

export interface UpdateArticleRequest {
  is_read?: boolean;
  is_saved?: boolean;
  priority?: Priority;
  user_note?: string | null;
}

// ============= Enhancement Types =============

export interface ContentExtractionResult {
  content: string;
  title: string;
  description?: string;
  author?: string;
  published_at?: string;
  image_url?: string;
  estimated_read_time: number;
}

export interface PageMetadata {
  title?: string;
  description?: string;
  author?: string;
  published_at?: string;
  image_url?: string;
  favicon?: string;
  canonical_url?: string;
  feeds?: Array<{
    url: string;
    title?: string;
    description?: string;
    type: "rss" | "atom" | "json";
  }>;
}

export interface SaveOptions {
  priority: Priority;
  folder_id?: string;
  note?: string;
  title?: string;
}

export type ExtractFullTextResponse = {
  content: string | null;
  estimated_read_time_minutes: number | null;
};

export type SummarizeResponse = {
  summary: string;
};

export type TranslateResponse = {
  translated_content: string;
  target_language: string;
};

export type SummarizeRequest = {
  content?: string;
};

export type TranslateRequest = {
  target_language: string;
  content?: string;
};
