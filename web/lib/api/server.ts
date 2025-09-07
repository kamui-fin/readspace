import { ApiClient } from "./client"

// Server-side data fetching utilities for Server Components
export class ServerApiClient {
    // Fetch sidebar data in parallel for initial SSR
    static async getSidebarData() {
        try {
            // Fetch all sidebar data in parallel
            const [folders, feeds, unreadCounts] = await Promise.all([
                ApiClient.rss.getFolders(),
                ApiClient.rss.getFeeds({}),
                ApiClient.rss.getUnreadCounts(),
            ])

            return {
                folders,
                feeds,
                unreadCounts,
            }
        } catch (error) {
            console.error("Failed to fetch sidebar data:", error)
            // Return empty data structure to prevent crashes
            return {
                folders: [],
                feeds: [],
                unreadCounts: {},
            }
        }
    }

    // Fetch articles data for different views
    static async getArticlesData(params: {
        feedId?: string
        folderId?: string
        mode?: "allArticles" | "recentlyRead" | "readLater"
        publishedSince?: string
        publishedUntil?: string
        page?: number
        size?: number
    }) {
        try {
            const { feedId, folderId, mode, publishedSince, publishedUntil, page = 1, size = 25 } = params

            let apiResponse: any
            
            if (mode === "recentlyRead") {
                apiResponse = await ApiClient.rss.getRecentlyReadArticles(page, size)
            } else if (mode === "readLater") {
                apiResponse = await ApiClient.rss.getReadLaterArticles(page, size)
            } else {
                // Regular articles with filters
                const articleParams: any = {
                    published_since: publishedSince,
                    published_until: publishedUntil,
                    page,
                    size,
                    sort_by: "published_at",
                    sort_order: "desc",
                }

                if (feedId) {
                    articleParams.feed_ids = [feedId]
                } else if (folderId) {
                    articleParams.folder_id = folderId
                }

                apiResponse = await ApiClient.rss.getArticles(articleParams)
            }

            // Transform API response to match expected format and ensure proper serialization
            console.log("Number of articles:", apiResponse.items.length)

            return apiResponse
        } catch (error) {
            console.error("Failed to fetch articles data:", error)
            // Return empty data structure to prevent crashes
            return {
                items: [],
                total: 0,
                page: 1,
                pages: 1,
                size: 25,
            }
        }
    }

    // Combined data fetching for article pages (sidebar + articles)
    static async getArticlePageData(params: {
        feedId?: string
        folderId?: string
        mode?: "allArticles" | "recentlyRead" | "readLater"
        publishedSince?: string
        publishedUntil?: string
        page?: number
        size?: number
    }) {
        try {
            const [sidebarData, articlesData] = await Promise.all([
                this.getSidebarData(),
                this.getArticlesData(params),
            ])

            return {
                ...sidebarData,
                articles: articlesData,
            }
        } catch (error) {
            console.error("Failed to fetch article page data:", error)
            const fallbackSidebar = await this.getSidebarData()
            return {
                ...fallbackSidebar,
                articles: {
                    items: [],
                    total: 0,
                    page: 1,
                    pages: 1,
                    size: 25,
                },
            }
        }
    }

    // Fetch individual pieces of data with error handling
    static async getFolders() {
        try {
            return await ApiClient.rss.getFolders()
        } catch (error) {
            console.error("Failed to fetch folders:", error)
            return []
        }
    }

    static async getFeeds(params?: {
        folder_id?: string
        tag_names?: string[]
        is_favorite?: boolean
        search_query?: string
    }) {
        try {
            return await ApiClient.rss.getFeeds(params)
        } catch (error) {
            console.error("Failed to fetch feeds:", error)
            return []
        }
    }

    static async getUnreadCounts(folderId?: string) {
        try {
            return await ApiClient.rss.getUnreadCounts(folderId)
        } catch (error) {
            console.error("Failed to fetch unread counts:", error)
            return {}
        }
    }

    // Get specific feed data
    static async getFeed(feedId: string) {
        try {
            return await ApiClient.rss.getFeed(feedId)
        } catch (error) {
            console.error(`Failed to fetch feed ${feedId}:`, error)
            return null
        }
    }

    // Refresh specific feed data
    static async refreshFeed(feedId: string, params?: {
        forceRefetch?: boolean
        preview?: boolean
    }) {
        try {
            return await ApiClient.rss.refreshFeed(feedId, params?.forceRefetch, params?.preview)
        } catch (error) {
            console.error(`Failed to refresh feed ${feedId}:`, error)
            throw error // Re-throw so the caller can handle it
        }
    }

    // Get specific folder data
    static async getFolder(folderId: string) {
        try {
            const folders = await this.getFolders()
            return folders.find(f => f.id === folderId) || null
        } catch (error) {
            console.error(`Failed to fetch folder ${folderId}:`, error)
            return null
        }
    }

    // Book-related methods
    static async getBooks(userId: string) {
        try {
            return await ApiClient.books.getUserBooks()
        } catch (error) {
            console.error("Failed to fetch books:", error)
            return []
        }
    }

    static async getBook(bookId: string) {
        try {
            return await ApiClient.books.getBook(bookId)
        } catch (error) {
            console.error(`Failed to fetch book ${bookId}:`, error)
            return null
        }
    }

    static async getBookHighlights(bookId: string) {
        try {
            return await ApiClient.highlights.getBookHighlights(bookId)
        } catch (error) {
            console.error(`Failed to fetch highlights for book ${bookId}:`, error)
            return []
        }
    }

    // OPML import methods
    static async getActiveImportTasks() {
        try {
            return await ApiClient.rss.listImportTasks()
        } catch (error) {
            console.error("Failed to fetch active import tasks:", error)
            return []
        }
    }

    // Direct API methods for infinite queries
    static async getArticles(params: {
        feed_ids?: string[]
        folder_id?: string
        is_read?: boolean
        is_read_later?: boolean
        is_favorite?: boolean
        feed_is_favorite?: boolean
        published_since?: string
        published_until?: string
        search_query?: string
        sort_by?: string
        sort_order?: string
        page?: number
        size?: number
    }) {
        try {
            return await ApiClient.rss.getArticles(params)
        } catch (error) {
            console.error("Failed to fetch articles:", error)
            return {
                items: [],
                total: 0,
                page: 1,
                pages: 1,
                size: 25,
            }
        }
    }

    static async getRecentlyReadArticles(page: number = 1, size: number = 25) {
        try {
            return await ApiClient.rss.getRecentlyReadArticles(page, size)
        } catch (error) {
            console.error("Failed to fetch recently read articles:", error)
            return {
                items: [],
                total: 0,
                page: 1,
                pages: 1,
                size: 25,
            }
        }
    }

    static async getReadLaterArticles(page: number = 1, size: number = 25) {
        try {
            return await ApiClient.rss.getReadLaterArticles(page, size)
        } catch (error) {
            console.error("Failed to fetch read later articles:", error)
            return {
                items: [],
                total: 0,
                page: 1,
                pages: 1,
                size: 25,
            }
        }
    }

    static async getTodaysArticles(params?: { page?: number, size?: number }) {
        try {
            return await ApiClient.rss.getTodaysArticles(params)
        } catch (error) {
            console.error("Failed to fetch today's articles:", error)
            return {
                items: [],
                total: 0,
                page: 1,
                pages: 1,
                size: 25,
            }
        }
    }

    // Discover methods
    static async searchFeeds(params?: {
        q?: string
        category?: string
        language?: string
        limit?: number
    }) {
        try {
            return await ApiClient.rss.searchFeeds(params)
        } catch (error) {
            console.error("Failed to search feeds:", error)
            return {
                results: [],
                total_count: 0,
                query: params?.q || null,
                category: params?.category || null,
                language: params?.language || "en",
            }
        }
    }

    static async getCategories(params?: { language?: string }) {
        try {
            return await ApiClient.rss.getCategories(params)
        } catch (error) {
            console.error("Failed to get categories:", error)
            return {
                categories: [],
                language: params?.language || "en",
            }
        }
    }

    static async getPreviewArticles(feedUrl: string, limit: number = 25) {
        try {
            // Use direct fetch since this is a new endpoint not in ApiClient yet
            const url = new URL('/api/rss/discover/preview/articles', process.env.API_BASE_URL || 'http://localhost:8008')
            url.searchParams.set('url', feedUrl)
            url.searchParams.set('limit', limit.toString())

            const response = await fetch(url.toString(), {
                headers: { 'Content-Type': 'application/json' },
            })

            if (!response.ok) {
                throw new Error(`Failed to get preview articles: ${response.statusText}`)
            }

            return await response.json()
        } catch (error) {
            console.error("Failed to get preview articles:", error)
            return {
                items: [],
                total: 0,
                page: 1,
                size: limit,
                pages: 1
            }
        }
    }

    static async getCategoryFeeds(categoryName: string, params?: {
        language?: string
        limit?: number
    }) {
        try {
            return await ApiClient.rss.getCategoryFeeds(categoryName, params)
        } catch (error) {
            console.error("Failed to get category feeds:", error)
            return {
                results: [],
                total_count: 0,
                query: null,
                category: categoryName,
                language: params?.language || "en",
            }
        }
    }

    static async getSimilarFeeds(feedId: string, params?: {
        limit?: number
        min_similarity?: number
    }) {
        try {
            return await ApiClient.rss.getSimilarFeeds(feedId, params)
        } catch (error) {
            console.error("Failed to get similar feeds:", error)
            return {
                source_feed: {
                    id: feedId,
                    title: null,
                    description: null,
                    url: "",
                    link: null,
                    image_url: null
                },
                similar_feeds: []
            }
        }
    }
} 
