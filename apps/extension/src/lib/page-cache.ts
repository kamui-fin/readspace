import { LRUCache } from 'lru-cache'
import browser from 'webextension-polyfill'
import { normalizeKey } from './normalize'
import debounce from 'debounce'
import { CachedPageData } from '../types'

const MAX_CACHE_SIZE = 200
const CACHE_STORAGE_KEY_PREFIX = 'readspace-page-cache-v1:'
const PAGE_CACHE_MAX_ITEMS_PER_DOMAIN = 100
const PERSIST_DEBOUNCE_MS = 1000

class PageCache {
  private cache = new LRUCache<string, CachedPageData>({ max: MAX_CACHE_SIZE })
  private initialized = false
  private dirty = false
  private persistDebounced = debounce(() => this.persist(), PERSIST_DEBOUNCE_MS)

  async init() {
    if (this.initialized) return
    this.initialized = true
  }

  private domainKey(url: string) {
    try {
      const u = new URL(url)
      return CACHE_STORAGE_KEY_PREFIX + u.hostname
    } catch {
      return CACHE_STORAGE_KEY_PREFIX + 'unknown'
    }
  }

  async get(url: string): Promise<CachedPageData | null> {
    const key = normalizeKey(url)
    const cached = this.cache.get(key)
    if (cached) return cached

    const dKey = this.domainKey(url)
    const kv = await browser.storage.local.get(dKey)
    const domainCache = (kv[dKey] || {}) as Record<string, CachedPageData>
    const stored = domainCache[key]

    if (stored) {
      this.cache.set(key, stored)
      return stored
    }

    return null
  }

  async set(url: string, data: CachedPageData) {
    const key = normalizeKey(url)
    this.cache.set(key, data)
    this.dirty = true
    this.persistDebounced()
  }

  async setMetadata(url: string, metadata: any) {
    const existing = await this.get(url)
    const data: CachedPageData = existing || {
      url,
      metadata: null,
      content: null,
      fetchedAt: Date.now()
    }
    data.metadata = metadata
    data.fetchedAt = Date.now()
    await this.set(url, data)
  }

  async setContent(url: string, content: any) {
    const existing = await this.get(url)
    const data: CachedPageData = existing || {
      url,
      metadata: null,
      content: null,
      fetchedAt: Date.now()
    }
    data.content = content
    data.fetchedAt = Date.now()
    await this.set(url, data)
  }

  private async persist() {
    if (!this.dirty) return

    const updates: Record<string, Record<string, CachedPageData>> = {}

    // Iterate over LRU cache
    // Using entries() to ensure compatibility
    for (const [key, value] of this.cache.entries()) {
      try {
        const domain = new URL(key).hostname
        const dKey = CACHE_STORAGE_KEY_PREFIX + domain
        if (!updates[dKey]) updates[dKey] = {}
        updates[dKey][key] = value
      } catch { }
    }

    const domainKeys = Object.keys(updates)
    if (domainKeys.length === 0) return

    const existingData = await browser.storage.local.get(domainKeys)

    const finalUpdates: Record<string, Record<string, CachedPageData>> = {}

    for (const dKey of domainKeys) {
      const existingDomainCache = (existingData[dKey] || {}) as Record<string, CachedPageData>
      const newItems = updates[dKey]

      const merged = { ...existingDomainCache, ...newItems }

      const keys = Object.keys(merged)
      if (keys.length > PAGE_CACHE_MAX_ITEMS_PER_DOMAIN) {
        keys.sort((a, b) => (merged[a].fetchedAt - merged[b].fetchedAt))
        const trim = keys.length - PAGE_CACHE_MAX_ITEMS_PER_DOMAIN
        for (let i = 0; i < trim; i++) delete merged[keys[i]]
      }

      finalUpdates[dKey] = merged
    }

    await browser.storage.local.set(finalUpdates)
    this.dirty = false
  }

  async clear() {
    this.cache.clear();
    const all = await browser.storage.local.get(null)
    const keysToRemove = Object.keys(all).filter(k => k.startsWith(CACHE_STORAGE_KEY_PREFIX))
    await browser.storage.local.remove(keysToRemove)
  }
}

export const pageCache = new PageCache()
