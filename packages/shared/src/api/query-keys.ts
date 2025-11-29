// Centralized query keys for consistency between server and client
export const RSS_QUERY_KEYS = {
  FOLDERS: "rss-folders",
  FEEDS: "rss-feeds",
  FEED_UNREAD_COUNTS: "rss-feed-unread-counts",
  ARTICLES: "rss-articles",
  ARTICLE: "rss-article",
  UNREAD_COUNTS: "rss-unread-counts",
  OPML_IMPORT_STATUS: "opml-import-status",
  OPML_IMPORT_TASKS: "opml-import-tasks",
  REFRESH_STATUS: "refresh-status",
  TRENDING_FEEDS: "rss-trending-feeds",
  DISCOVER_RECOMMENDATIONS: "rss-discover-recommendations",
  SIDEBAR_DATA: "rss-sidebar-data",
} as const;

export const ARTICLE_ENHANCEMENT_QUERY_KEYS = {
  EXTRACTED_CONTENT: "article-extracted-content",
  SUMMARY: "article-summary",
  TRANSLATION: "article-translation",
} as const;

export const USER_QUERY_KEYS = {
  PROFILE: "user-profile",
} as const;

export type QueryKey =
  | (typeof RSS_QUERY_KEYS)[keyof typeof RSS_QUERY_KEYS]
  | (typeof ARTICLE_ENHANCEMENT_QUERY_KEYS)[keyof typeof ARTICLE_ENHANCEMENT_QUERY_KEYS]
  | (typeof USER_QUERY_KEYS)[keyof typeof USER_QUERY_KEYS];

/**
 * Helper functions to create consistent query keys
 */
export const queryKeys = {
  // Folders
  folders: () => [RSS_QUERY_KEYS.FOLDERS] as const,

  // Feeds
  feeds: (params?: {
    folderId?: string;
    tagNames?: string[];
    isFavorite?: boolean;
  }) => [RSS_QUERY_KEYS.FEEDS, params] as const,
  feed: (feedId: string) => [RSS_QUERY_KEYS.FEEDS, feedId] as const,

  // Articles
  articles: (params?: {
    feedIds?: string[];
    folderId?: string;
    cursor?: string;
    limit?: number;
    isRead?: boolean;
    isReadLater?: boolean;
    isFavorite?: boolean;
  }) => [RSS_QUERY_KEYS.ARTICLES, params] as const,

  infiniteArticles: (params?: {
    feedIds?: string[];
    folderId?: string;
    limit?: number;
    isRead?: boolean;
    isReadLater?: boolean;
    isFavorite?: boolean;
  }) => [RSS_QUERY_KEYS.ARTICLES, "infinite", params] as const,

  infiniteReadLater: () =>
    [RSS_QUERY_KEYS.ARTICLES, "infinite", "read_later"] as const,
  infiniteRecentlyRead: () =>
    [RSS_QUERY_KEYS.ARTICLES, "infinite", "recently_read"] as const,
  infiniteToday: () => [RSS_QUERY_KEYS.ARTICLES, "infinite", "today"] as const,

  article: (articleId: string) => [RSS_QUERY_KEYS.ARTICLE, articleId] as const,
  checkArticleSaved: (url: string) =>
    [RSS_QUERY_KEYS.ARTICLE, `check-${url}`] as const,

  // Counts
  unreadCounts: () => [RSS_QUERY_KEYS.UNREAD_COUNTS] as const,
  feedUnreadCounts: () => [RSS_QUERY_KEYS.FEED_UNREAD_COUNTS] as const,

  // Enhancements
  extractedContent: (articleId: string, urlHash: string) =>
    [
      ARTICLE_ENHANCEMENT_QUERY_KEYS.EXTRACTED_CONTENT,
      articleId,
      urlHash,
    ] as const,
  summary: (articleId: string, contentHash: string) =>
    [ARTICLE_ENHANCEMENT_QUERY_KEYS.SUMMARY, articleId, contentHash] as const,
  translation: (
    articleId: string,
    targetLanguage: string,
    contentHash: string,
  ) =>
    [
      ARTICLE_ENHANCEMENT_QUERY_KEYS.TRANSLATION,
      articleId,
      targetLanguage,
      contentHash,
    ] as const,

  // OPML
  opmlImportStatus: (taskId: string | null) =>
    [RSS_QUERY_KEYS.OPML_IMPORT_STATUS, taskId] as const,
  opmlImportTasks: () => [RSS_QUERY_KEYS.OPML_IMPORT_TASKS] as const,
  refreshStatus: (taskId: string | null) =>
    [RSS_QUERY_KEYS.REFRESH_STATUS, taskId] as const,

  // User
  userProfile: () => [USER_QUERY_KEYS.PROFILE] as const,
} as const;

export const MUTATION_KEYS = {
  // Articles
  UPDATE_ARTICLE: "update-article",
  SAVE_ARTICLE: "save-article",
  UNSAVE_ARTICLE: "unsave-article",

  // Feeds
  CREATE_FEED: "create-feed",
  UPDATE_FEED: "update-feed",
  REFRESH_FEED: "refresh-feed",
  REFRESH_ALL_FEEDS: "refresh-all-feeds",
  DELETE_FEED: "delete-feed",
  ADMIN_DELETE_FEED: "admin-delete-feed",
  BULK_DELETE_FEEDS: "bulk-delete-feeds",
  BULK_UPDATE_FEEDS_FOLDER: "bulk-update-feeds-folder",
  SUBSCRIBE_TO_FEED: "subscribe-to-feed",

  // Folders
  CREATE_FOLDER: "create-folder",
  UPDATE_FOLDER: "update-folder",
  DELETE_FOLDER: "delete-folder",
  MARK_FOLDER_ALL_READ: "mark-folder-all-read",
  MARK_FEED_ALL_READ: "mark-feed-all-read",
} as const;

export const mutationKeys = {
  // Articles
  updateArticle: () => [MUTATION_KEYS.UPDATE_ARTICLE] as const,
  saveArticle: () => [MUTATION_KEYS.SAVE_ARTICLE] as const,
  unsaveArticle: () => [MUTATION_KEYS.UNSAVE_ARTICLE] as const,

  // Feeds
  createFeed: () => [MUTATION_KEYS.CREATE_FEED] as const,
  updateFeed: () => [MUTATION_KEYS.UPDATE_FEED] as const,
  refreshFeed: () => [MUTATION_KEYS.REFRESH_FEED] as const,
  refreshAllFeeds: () => [MUTATION_KEYS.REFRESH_ALL_FEEDS] as const,
  deleteFeed: () => [MUTATION_KEYS.DELETE_FEED] as const,
  adminDeleteFeed: () => [MUTATION_KEYS.ADMIN_DELETE_FEED] as const,
  bulkDeleteFeeds: () => [MUTATION_KEYS.BULK_DELETE_FEEDS] as const,
  bulkUpdateFeedsFolder: () =>
    [MUTATION_KEYS.BULK_UPDATE_FEEDS_FOLDER] as const,
  subscribeToFeed: () => [MUTATION_KEYS.SUBSCRIBE_TO_FEED] as const,

  // Folders
  createFolder: () => [MUTATION_KEYS.CREATE_FOLDER] as const,
  updateFolder: () => [MUTATION_KEYS.UPDATE_FOLDER] as const,
  deleteFolder: () => [MUTATION_KEYS.DELETE_FOLDER] as const,
  markFolderAllRead: () => [MUTATION_KEYS.MARK_FOLDER_ALL_READ] as const,
  markFeedAllRead: () => [MUTATION_KEYS.MARK_FEED_ALL_READ] as const,
} as const;
