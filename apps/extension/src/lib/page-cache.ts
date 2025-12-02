import { LRUCache } from 'lru-cache'
import browser from 'webextension-polyfill'
import { CachedPageContent, CachedPageMetadata } from '@/types'

/**
 * Page Cache Utility
 *
 * Manages a cache of the last 5 visited pages with their metadata and content.
 * Uses lru-cache to maintain cache size.
 */

export interface CachedPageData {
  url: string
  metadata: CachedPageMetadata | null
  content: CachedPageContent | null
  timestamp: number
}

const MAX_CACHE_SIZE = 5
const CACHE_STORAGE_KEY = 'readspace-page-cache'

class PageCache {
  private cache: LRUCache<string, CachedPageData>
  private initialized = false

  constructor() {
    this.cache = new LRUCache<string, CachedPageData>({
      max: MAX_CACHE_SIZE,
    })
  }

  /**
   * Initialize cache from storage
   */
  async init(): Promise<void> {
    if (this.initialized) return

    try {
      const result = await browser.storage.local.get(CACHE_STORAGE_KEY)
      const storedCache = result[CACHE_STORAGE_KEY]

      if (storedCache) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.cache.load(storedCache as any)
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
      const dump = this.cache.dump()
      await browser.storage.local.set({ [CACHE_STORAGE_KEY]: dump })
    } catch (error) {
      console.error('Failed to persist page cache to storage:', error)
    }
  }

  /**
   * Get cached data for a URL
   */
  async get(url: string): Promise<CachedPageData | null> {
    await this.init()
    const cached = this.cache.get(url)

    if (cached) {
      // Update access time in storage (LRU order changed)
      await this.persist()
    }

    return cached || null
  }

  /**
   * Set metadata for a URL
   */
  async setMetadata(url: string, metadata: CachedPageMetadata): Promise<void> {
    await this.init()

    const existing = this.cache.get(url)
    const data: CachedPageData = existing || {
      url,
      metadata: null,
      content: null,
      timestamp: Date.now(),
    }

    data.metadata = metadata
    data.timestamp = Date.now()

    this.cache.set(url, data)
    await this.persist()
  }

  /**
   * Set content for a URL
   */
  async setContent(url: string, content: CachedPageContent): Promise<void> {
    await this.init()

    const existing = this.cache.get(url)
    const data: CachedPageData = existing || {
      url,
      metadata: null,
      content: null,
      timestamp: Date.now(),
    }

    data.content = content
    data.timestamp = Date.now()

    this.cache.set(url, data)
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

    const data: CachedPageData = {
      url,
      metadata,
      content,
      timestamp: Date.now(),
    }

    this.cache.set(url, data)
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
}

// Export singleton instance
export const pageCache = new PageCache()
