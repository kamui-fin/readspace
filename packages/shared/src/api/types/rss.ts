import type { ApiPaginatedResponse, PaginatedResponse, CursorPaginatedResponse } from "./api";

// Feed category enum - matches backend FeedCategory
export const FEED_CATEGORIES = {
  TECHNOLOGY_PROGRAMMING: "Technology & Programming",
  CULTURE_ARTS: "Culture & Arts",
  LIFESTYLE_PERSONAL: "Lifestyle & Personal",
  MISCELLANEOUS: "Miscellaneous",
  DESIGN_CREATIVITY: "Design & Creativity",
  SCIENCE_RESEARCH: "Science & Research",
  NEWS_POLITICS: "News & Politics",
  GAMING_ENTERTAINMENT: "Gaming & Entertainment",
  BUSINESS_FINANCE: "Business & Finance",
  ARTIFICIAL_INTELLIGENCE: "Artificial Intelligence",
  SECURITY_PRIVACY: "Security & Privacy",
  EDUCATION_LEARNING: "Education & Learning",
} as const;

export type FeedCategory =
  (typeof FEED_CATEGORIES)[keyof typeof FEED_CATEGORIES];

// Types based on API responses
export type Folder = {
  id: string;
  name: string;
  user_id?: string;
  created_at?: string;
};

export type Feed = {
  id: string;
  title: string;
  url: string; // RSS feed URL
  link: string | null; // Website URL (the human-readable site)
  description: string;
  image_url: string | null;
  folder_id: string | null;
  folder_name: string | null;
  is_favorite: boolean;
  language: string | null;
  tags: string[] | null; // Array of tag names from the database
  top_level_category: string | null; // Feed category enum value
  popularity_score: number | null; // Popularity estimate (0-100)
  last_fetched_at: string | null;
  unread_count: number;
  fetch_error_count: number;
  last_error_message: string | null;
  last_article_published_at: string | null;
  // Preview mode support
  is_subscribed?: boolean;
  // Preview-specific fields (when used in discovery/preview context)
  preview_url?: string;
  is_preview?: boolean;
};

// Subscription type - matches backend SubscriptionResponse
export type Subscription = {
  id: string;
  user_id: string;
  feed_id: string;
  folder_id: string;
  is_favorite: boolean;
  custom_title: string | null;
  created_at: string;
  updated_at: string;
  feed: {
    id: string;
    url: string;
    title: string | null;
    link: string | null;
    language: string | null;
    image_url: string | null;
    last_fetched_at: string | null;
    last_article_published_at: string | null;
  };
  folder: {
    id: string;
    name: string;
    user_id: string;
    created_at: string;
  };
};

export type SidebarData = {
  folders: Folder[];
  feeds: Feed[];
  unreadCounts: Record<string, number>;
};

// OPML Import types
export type OPMLImportResponse = {
  processing_mode?: "background";
  task_id?: string;
  message?: string;
  estimated_feeds?: number;
  check_status_url?: string;
  // Results when completed (in task status)
  imported_count?: number;
  failed_count?: number;
  already_existed_count?: number;
  total_feeds?: number;
  errors?: Array<{
    url: string;
    title: string;
    error: string;
    status: string;
  }>;
  broken_feeds?: Array<{
    url: string;
    title: string;
    error: string;
    status: string;
  }>;
  summary?: {
    successful: number;
    already_existed: number;
    failed: number;
  };
};

export type OPMLImportCancelResponse = {
  task_id: string;
  message: string;
  cancelled: boolean;
  previous_state?: string;
  cancelled_subtasks?: number;
  redirect_url?: string;
};

export type ImportTaskStatus = {
  task_id: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  message: string;
  result?: OPMLImportResponse;
  progress?: {
    completed: number;
    total: number;
    successful: number;
    failed: number;
    already_existed: number;
  };
  error?: string;
};

// Type for active import task list items from /api/rss/opml/import/tasks
export type ActiveImportTask = {
  user_id: string;
  task_id: string;
  estimated_feeds: number;
  filename: string;
  created_at: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  current_status?: string;
};

// Corresponds to FeedBasicInfo in rss_schemas.py
export type FeedBasicInfo = {
  id: string; // Changed from UUID to string for frontend consistency, assuming conversion happens
  title: string | null;
  url: string; // Changed from HttpUrl to string
  image_url: string | null; // Changed from HttpUrl to string
};

// Export the Article type
export type Article = {
  id: string;
  feed_id: string;
  // feed_title: string; // This will now come from the nested feed object if needed
  title: string;
  link: string; // Changed from url to link, matches backend model
  description: string | null; // Made nullable to match schema (Optional[str])
  content: string | null; // Made nullable to match schema (Optional[str])
  image_url: string | null;
  author: string | null; // Kept, though not explicitly in ArticleBase, might be populated
  published_at: string | null; // Made nullable to match schema (Optional[datetime])
  is_read: boolean;
  read_at: string | null;
  is_read_later: boolean;
  is_favorite: boolean;
  created_at: string;
  updated_at: string; // Added
  user_id: string; // Added
  guid: string; // Added
  estimated_read_time_minutes: number | null; // Added, made nullable
  custom_metadata: unknown | null; // JSON field with dynamic structure
  feed?:
  | FeedBasicInfo
  | {
    id: string | null;
    title: string | null;
    url: string | null;
    image_url: string | null;
  }; // More flexible feed object for both RSS and clipped articles
  article_type: "feed" | "clipped";
  priority?: string | null; // Added for clipped articles
  note?: string | null; // Added for clipped articles
  // Auto-extracted content fields
  extracted_content?: string | null; // Full content extracted from article URL
  extracted_read_time?: number | null; // Read time for extracted content
};

// Articles pagination response type - matches backend PaginatedResponse[ArticleResponse]
export type ArticlesPaginatedResponse = PaginatedResponse<Article>;

// Ensure PaginatedResponse is also exported if it wasn't already
export type { PaginatedResponse, ApiPaginatedResponse, CursorPaginatedResponse };

export interface UnreadCounts {
  total_unread?: number;
  unread_by_folder?: Record<string, number>; // Dictionary with folder IDs as keys
  read_later_count?: number;
  today_count?: number;
}

// Discover/Search feed types - matches backend FeedDiscoveryResult
export interface FeedDiscoveryResult {
  id: string;
  title: string | null;
  description: string | null;
  url: string;
  link: string | null;
  image_url: string | null;
  tags: string[];
  language: string | null;
  category: string | null;
  popularity_score: number;
  relevance: number;
  search_metadata?: Record<string, unknown>;
  // Fields for preview mode
  is_preview?: boolean;
  preview_url?: string;
  is_subscribed?: boolean;
}

// Discover search response - matches backend DiscoverSearchResponse
export interface DiscoverSearchResponse {
  results: FeedDiscoveryResult[];
  total_count: number;
  query: string | null;
  category: string | null;
  language: string;
}

// Similar feeds response - matches backend router response
export interface SimilarFeedsResponse {
  source_feed: {
    id: string;
    title: string | null;
    description: string | null;
    url: string;
    link: string | null;
    image_url: string | null;
  };
  similar_feeds: FeedDiscoveryResult[];
}

// Article save/check response types
export interface SaveArticleResponse {
  success: boolean;
  article_id: string;
}

export type CheckArticleSavedResponse =
  | {
      is_saved: true;
      article_id: string;
      // Include metadata fields needed by extension (without heavy content)
      id: string;
      title: string | null;
      note: string | null;
      priority: string | null;
      is_read: boolean;
      is_read_later: boolean;
      read_at: string | null;
    }
  | {
      is_saved: false;
      article_id: null;
    };

// Helper function to convert FeedDiscoveryResult to Feed
export function feedDiscoveryResultToFeed(
  discoveryResult: FeedDiscoveryResult,
): Feed {
  return {
    id: discoveryResult.id,
    title: discoveryResult.title || "",
    url: discoveryResult.url,
    link: discoveryResult.link,
    description: discoveryResult.description || "",
    image_url: discoveryResult.image_url,
    folder_id: null,
    folder_name: null,
    is_favorite: false,
    language: discoveryResult.language,
    tags: discoveryResult.tags,
    top_level_category: discoveryResult.category,
    popularity_score: discoveryResult.popularity_score,
    last_fetched_at: null,
    unread_count: 0,
    fetch_error_count: 0,
    last_error_message: null,
    last_article_published_at: null,
    is_subscribed: discoveryResult.is_subscribed,
    preview_url: discoveryResult.preview_url,
    is_preview: discoveryResult.is_preview,
  };
}
