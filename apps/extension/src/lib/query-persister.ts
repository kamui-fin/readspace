import { browser } from '@/lib/browser'
import type {
  PersistedClient,
  Persister,
} from '@tanstack/react-query-persist-client'

/**
 * Creates a persister for TanStack Query that uses Chrome's storage API
 * This allows the query cache to persist across extension sessions
 */
export function createChromeStoragePersister(
  storageKey: string = 'tanstack-query-cache',
  options: { throttleTime?: number; debug?: boolean } = {}
): Persister {
  const { throttleTime = 1000, debug = true } = options
  let persistTimeout: NodeJS.Timeout | null = null

  return {
    persistClient: async (client: PersistedClient) => {
      try {
        // Throttle persistence to avoid excessive writes
        if (persistTimeout) {
          clearTimeout(persistTimeout)
        }

        persistTimeout = setTimeout(async () => {
          // Chrome storage API requires serialization to JSON string
          const serialized = JSON.stringify(client)
          await browser.storage.local.set({ [storageKey]: serialized })

          // Log cache size for debugging (only if debug enabled)
          if (debug) {
            const sizeInKB = (serialized.length / 1024).toFixed(2)
            console.log(
              `[Query Cache] Persisted ${sizeInKB}KB to chrome.storage.local`
            )
          }
        }, throttleTime)
      } catch (error) {
        console.error('[Query Cache] Failed to persist query client:', error)
      }
    },

    restoreClient: async () => {
      try {
        const result = await browser.storage.local.get(storageKey)
        const serialized = result[storageKey]

        if (!serialized || typeof serialized !== 'string') {
          if (debug) {
            console.log('[Query Cache] No cached data found')
          }
          return undefined
        }

        const client = JSON.parse(serialized) as PersistedClient

        if (debug) {
          const sizeInKB = (serialized.length / 1024).toFixed(2)
          console.log(
            `[Query Cache] Restored ${sizeInKB}KB from chrome.storage.local`
          )
        }

        return client
      } catch (error) {
        console.error('[Query Cache] Failed to restore query client:', error)
        return undefined
      }
    },

    removeClient: async () => {
      try {
        await browser.storage.local.remove(storageKey)
        if (debug) {
          console.log('[Query Cache] Removed cached data')
        }
      } catch (error) {
        console.error('[Query Cache] Failed to remove query client:', error)
      }
    },
  }
}
