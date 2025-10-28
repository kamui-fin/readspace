// Centralized query keys for consistency between server and client
export const RSS_QUERY_KEYS = {
  FOLDERS: "rss-folders",
  FEEDS: "rss-feeds",
  ARTICLES: "rss-articles",
  ARTICLE: "rss-article",
  UNREAD_COUNTS: "rss-unread-counts",
  SIDEBAR_DATA: "rss-sidebar-data",
  OPML_IMPORT_STATUS: "opml-import-status",
  OPML_IMPORT_TASKS: "opml-import-tasks",
  REFRESH_STATUS: "refresh-status",
  TRENDING_FEEDS: "rss-trending-feeds",
  DISCOVER_RECOMMENDATIONS: "rss-discover-recommendations",
} as const;

export const ARTICLE_ENHANCEMENT_QUERY_KEYS = {
  EXTRACTED_CONTENT: "article-extracted-content",
  SUMMARY: "article-summary",
  TRANSLATION: "article-translation",
} as const;

export const BOOK_QUERY_KEYS = {
  BOOKS: "books",
  BOOK: "book",
  HIGHLIGHTS: "highlights",
} as const;

export const USER_QUERY_KEYS = {
  PROFILE: "user-profile",
} as const;

export type QueryKey =
  | (typeof RSS_QUERY_KEYS)[keyof typeof RSS_QUERY_KEYS]
  | (typeof ARTICLE_ENHANCEMENT_QUERY_KEYS)[keyof typeof ARTICLE_ENHANCEMENT_QUERY_KEYS]
  | (typeof BOOK_QUERY_KEYS)[keyof typeof BOOK_QUERY_KEYS]
  | (typeof USER_QUERY_KEYS)[keyof typeof USER_QUERY_KEYS];
