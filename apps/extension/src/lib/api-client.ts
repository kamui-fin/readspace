import {
  ApiClient,
  type AuthTokenProvider,
  type TokenRefreshProvider,
} from '@readspace/shared'
import { getSupabaseClient } from './supabase'

/**
 * Lazy-loaded reference to store to avoid circular dependency.
 * This is set by the store after it's initialized.
 */
let storeGetter:
  | (() => {
    settings: {
      access_token?: string
      readspace_url?: string
      supabase_url?: string
      supabase_anon_key?: string
    }
    updateToken: (token: string) => Promise<void>
  })
  | null = null

/**
 * Set the store getter function.
 * This should be called by the store after initialization to avoid circular dependencies.
 */
export function setStoreGetter(
  getter: () => {
    settings: {
      access_token?: string
      readspace_url?: string
      supabase_url?: string
      supabase_anon_key?: string
    }
    updateToken: (token: string) => Promise<void>
  }
) {
  storeGetter = getter
}

/**
 * Auth token provider that reads from extension store.
 * This matches the pattern used in apps/web/lib/api-client.ts
 */
const getAuthToken: AuthTokenProvider = async (): Promise<string | null> => {
  try {
    if (!storeGetter) {
      console.warn('Store getter not initialized yet')
      return null
    }
    const state = storeGetter()
    return state.settings.access_token || null
  } catch (error) {
    console.warn('Failed to get access token from store:', error)
    return null
  }
}

/**
 * Token refresh provider that calls Supabase to get a fresh session.
 * This is called when we receive a 401 error from the API.
 */
const refreshToken: TokenRefreshProvider = async (): Promise<string | null> => {
  try {
    if (!storeGetter) {
      console.warn('Store getter not initialized for token refresh')
      return null
    }

    const state = storeGetter()
    const { supabase_url, supabase_anon_key } = state.settings

    if (!supabase_url || !supabase_anon_key) {
      console.warn('Supabase not configured, cannot refresh token')
      return null
    }

    // Get the Supabase client
    const supabase = getSupabaseClient(supabase_url, supabase_anon_key)
    if (!supabase) {
      console.warn('Failed to get Supabase client for token refresh')
      return null
    }

    // Call getSession which will automatically refresh the token if needed
    console.log('🔄 Refreshing session with Supabase...')
    const { data, error } = await supabase.auth.getSession()

    if (error) {
      console.error('❌ Failed to refresh session:', error)
      return null
    }

    if (!data.session?.access_token) {
      console.warn('⚠️ No session found during refresh')
      return null
    }

    const newToken = data.session.access_token
    console.log('✅ Token refreshed successfully')

    // Update the token in the store
    await state.updateToken(newToken)

    return newToken
  } catch (error) {
    console.error('❌ Token refresh error:', error)
    return null
  }
}

/**
 * Configure the shared ApiClient for extension use.
 * This must be called AFTER the store is initialized.
 */
export function configureExtensionApiClient() {
  try {
    if (!storeGetter) {
      console.warn('Store getter not set, using default configuration')
      ApiClient.configure({
        baseUrl: 'https://api.readspace.ai',
        getAuthToken,
        refreshToken,
      })
      return
    }

    const state = storeGetter()
    const baseUrl = state.settings.readspace_url || 'https://api.readspace.ai'

    ApiClient.configure({
      baseUrl,
      getAuthToken,
      refreshToken,
    })
  } catch (error) {
    console.error('Failed to configure ApiClient:', error)

    // Fallback configuration
    ApiClient.configure({
      baseUrl: 'https://api.readspace.ai',
      getAuthToken: async () => null,
      refreshToken: async () => null,
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
 * const articles = await ApiClient.getArticles({ page: 1 })
 * const folders = await ApiClient.getFolders()
 * ```
 */
export { ApiClient }
