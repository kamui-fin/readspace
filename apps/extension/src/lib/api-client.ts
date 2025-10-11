import { useExtensionStore } from '@/store'
import { ApiClient, type AuthTokenProvider } from '@readspace/shared'

/**
 * Get the extension store dynamically to avoid circular dependency.
 * We import it inside the function rather than at module level.
 */
function getExtensionStore() {
  // Dynamic import to break circular dependency

  return useExtensionStore.getState()
}

/**
 * Auth token provider that reads from extension store.
 * This matches the pattern used in apps/web/lib/api-client.ts
 */
const getAuthToken: AuthTokenProvider = async (): Promise<string | null> => {
  try {
    const state = getExtensionStore()
    return state.settings.access_token || null
  } catch (error) {
    console.warn('Failed to get access token from store:', error)
    return null
  }
}

/**
 * Configure the shared ApiClient for extension use.
 * This must be called AFTER the store is initialized.
 */
export function configureExtensionApiClient() {
  try {
    const state = getExtensionStore()
    const baseUrl = state.settings.readspace_url || 'https://api.readspace.ai'

    ApiClient.configure({
      baseUrl,
      getAuthToken,
    })

    console.log('ApiClient configured for extension with baseUrl:', baseUrl)
  } catch (error) {
    console.error('Failed to configure ApiClient:', error)

    // Fallback configuration
    ApiClient.configure({
      baseUrl: 'https://api.readspace.ai',
      getAuthToken: async () => null,
    })
  }
}

/**
 * Export the ApiClient for use throughout the extension.
 * Same pattern as apps/web/lib/api-client.ts
 *
 * NOTE: The store must call configureExtensionApiClient() after initialization!
 *
 * @example
 * ```typescript
 * import { ApiClient } from '@/lib/api-client'
 *
 * const articles = await ApiClient.rss.getArticles({ page: 1 })
 * const folders = await ApiClient.rss.getFolders()
 * ```
 */
export { ApiClient }
