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
} as const

export const BOOK_QUERY_KEYS = {
    BOOKS: "books",
    BOOK: "book",
    HIGHLIGHTS: "highlights",
} as const

export type QueryKey = (typeof RSS_QUERY_KEYS)[keyof typeof RSS_QUERY_KEYS] | (typeof BOOK_QUERY_KEYS)[keyof typeof BOOK_QUERY_KEYS] 