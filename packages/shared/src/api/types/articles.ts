import { PaginatedResponse } from "./common";

export enum ArticlePriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
}

// Alias for backward compatibility
export type Priority = ArticlePriority;

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

export interface ContentFields {
  title: string | null;
  link: string;
  description: string | null;
  content: string | null;
  image_url: string | null;
  author: string | null;
  tags: string[] | null;
}

export interface UserStateFields {
  is_read: boolean;
  is_saved: boolean;
  priority: ArticlePriority;
  user_note: string | null;
  read_at: string | null;
}

export interface FeedContextFields {
  feed_id: string | null;
  feed_title: string | null;
  feed_icon: string | null;
  published_at: string | null;
}

/**
 * Lightweight article for lists - no heavy content
 */
export interface ArticleSummary extends UserStateFields, FeedContextFields {
  id: string;
  source_domain: string | null;
  created_at: string;
  article_type: string; // "feed" or "clipped"

  // Content fields (subset/overridden)
  title: string | null;
  link: string;
  image_url: string | null;
  author: string | null;
  tags: string[] | null;
  description: string | null; // Truncated preview
  // content is excluded in list view
}

/**
 * Full article detail with content - for reader view
 */
export interface Article extends ArticleSummary {
  content: string | null; // Full HTML content
  description: string | null; // Full description (not truncated)

  // Auto-extraction fields (added by service layer)
  extracted_content?: string | null;
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
      priority: ArticlePriority | null;
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
  priority?: ArticlePriority;
  note?: string;
}

export interface UpdateArticleRequest {
  is_read?: boolean;
  is_saved?: boolean;
  priority?: ArticlePriority;
  user_note?: string | null;
  title?: string | null;
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

export interface DiscoveredFeed {
  url: string;
  title?: string;
  description?: string;
  type: "rss" | "atom" | "json";
}

export interface PageMetadata {
  title?: string;
  description?: string;
  author?: string;
  published_at?: string;
  image_url?: string;
  favicon?: string;
  canonical_url?: string;
  feeds?: DiscoveredFeed[];
}

export interface SaveOptions {
  priority: ArticlePriority;
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
  language_key?: string;
};

export type TranslateRequest = {
  target_language: string;
  content?: string;
};
