/**
 * Page Cache Utility
 *
 * Manages a cache of the last 5 visited pages with their metadata and content.
 * Uses an LRU (Least Recently Used) strategy to maintain cache size.
 */

export interface CachedPageMetadata {
  title?: string
  description?: string
  author?: string
  published_at?: string
  image_url?: string
  favicon?: string
  canonical_url?: string
  feeds?: Array<{ url: string; title?: string; type: string }>
}

export interface CachedPageContent {
  content?: string
  title?: string
  description?: string
  author?: string
  published_at?: string
  image_url?: string
  estimated_read_time?: number
}

export interface CachedPageData {
  url: string
  metadata: CachedPageMetadata | null
  content: CachedPageContent | null
  timestamp: number
}

const MAX_CACHE_SIZE = 5
const CACHE_STORAGE_KEY = 'readspace-page-cache'

class PageCache {
  private cache: Map<string, CachedPageData> = new Map()
  private initialized = false

  /**
   * Initialize cache from storage
   */
  async init(): Promise<void> {
    if (this.initialized) return

    try {
      const result = await chrome.storage.local.get(CACHE_STORAGE_KEY)
      const storedCache = result[CACHE_STORAGE_KEY] as
        | Array<[string, CachedPageData]>
        | undefined

      if (storedCache && Array.isArray(storedCache)) {
        this.cache = new Map(storedCache)
      }
    } catch (error) {
      console.error('Failed to initialize page cache from storage:', error)
    }

    this.initialized = true
  }

  /**
   * Persist cache to storage
   */
  private async persist(): Promise<void> {
    try {
      const cacheArray = Array.from(this.cache.entries())
      await chrome.storage.local.set({ [CACHE_STORAGE_KEY]: cacheArray })
    } catch (error) {
      console.error('Failed to persist page cache to storage:', error)
    }
  }

  /**
   * Get normalized URL for cache key (removes hash and some query params)
   */
  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      // Remove hash fragment
      urlObj.hash = ''
      // Remove common tracking parameters but keep important ones
      const paramsToRemove = [
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_content',
        'utm_term',
        'fbclid',
        'gclid',
      ]
      paramsToRemove.forEach((param) => urlObj.searchParams.delete(param))
      return urlObj.href
    } catch {
      return url
    }
  }

  /**
   * Get cached data for a URL
   */
  async get(url: string): Promise<CachedPageData | null> {
    await this.init()
    const normalizedUrl = this.normalizeUrl(url)
    const cached = this.cache.get(normalizedUrl)

    if (cached) {
      // Update access time (move to end for LRU)
      this.cache.delete(normalizedUrl)
      this.cache.set(normalizedUrl, cached)
      await this.persist()
    }

    return cached || null
  }

  /**
   * Get only metadata for a URL
   */
  async getMetadata(url: string): Promise<CachedPageMetadata | null> {
    const cached = await this.get(url)
    return cached?.metadata || null
  }

  /**
   * Get only content for a URL
   */
  async getContent(url: string): Promise<CachedPageContent | null> {
    const cached = await this.get(url)
    return cached?.content || null
  }

  /**
   * Set metadata for a URL
   */
  async setMetadata(url: string, metadata: CachedPageMetadata): Promise<void> {
    await this.init()
    const normalizedUrl = this.normalizeUrl(url)

    // Get existing cached data or create new
    let cached = this.cache.get(normalizedUrl)
    if (!cached) {
      cached = {
        url: normalizedUrl,
        metadata: null,
        content: null,
        timestamp: Date.now(),
      }
    }

    // Update metadata and timestamp
    cached.metadata = metadata
    cached.timestamp = Date.now()

    // Remove oldest if we're at capacity and this is a new entry
    if (!this.cache.has(normalizedUrl) && this.cache.size >= MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }

    // Add/update in cache (will be at end for LRU)
    this.cache.delete(normalizedUrl)
    this.cache.set(normalizedUrl, cached)

    await this.persist()
  }

  /**
   * Set content for a URL
   */
  async setContent(url: string, content: CachedPageContent): Promise<void> {
    await this.init()
    const normalizedUrl = this.normalizeUrl(url)

    // Get existing cached data or create new
    let cached = this.cache.get(normalizedUrl)
    if (!cached) {
      cached = {
        url: normalizedUrl,
        metadata: null,
        content: null,
        timestamp: Date.now(),
      }
    }

    // Update content and timestamp
    cached.content = content
    cached.timestamp = Date.now()

    // Remove oldest if we're at capacity and this is a new entry
    if (!this.cache.has(normalizedUrl) && this.cache.size >= MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }

    // Add/update in cache (will be at end for LRU)
    this.cache.delete(normalizedUrl)
    this.cache.set(normalizedUrl, cached)

    await this.persist()
  }

  /**
   * Set both metadata and content for a URL
   */
  async set(
    url: string,
    metadata: CachedPageMetadata | null,
    content: CachedPageContent | null
  ): Promise<void> {
    await this.init()
    const normalizedUrl = this.normalizeUrl(url)

    const cached: CachedPageData = {
      url: normalizedUrl,
      metadata,
      content,
      timestamp: Date.now(),
    }

    // Remove oldest if we're at capacity and this is a new entry
    if (!this.cache.has(normalizedUrl) && this.cache.size >= MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }

    // Add/update in cache (will be at end for LRU)
    this.cache.delete(normalizedUrl)
    this.cache.set(normalizedUrl, cached)

    await this.persist()
  }

  /**
   * Clear entire cache
   */
  async clear(): Promise<void> {
    await this.init()
    this.cache.clear()
    await this.persist()
  }

  /**
   * Get cache size
   */
  async size(): Promise<number> {
    await this.init()
    return this.cache.size
  }

  /**
   * Get all cached URLs
   */
  async getCachedUrls(): Promise<string[]> {
    await this.init()
    return Array.from(this.cache.keys())
  }
}

// Export singleton instance
export const pageCache = new PageCache()
