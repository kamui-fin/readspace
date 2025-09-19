import { ApiClient, type ApiClientConfig, type AuthTokenProvider } from "@readspace/shared"

// Add RequestInit type for extension environment
type RequestInit = globalThis.RequestInit

// Browser extension API type declarations
interface ExtensionStorageAPI {
  local: {
    get(keys: string[]): Promise<Record<string, unknown>>
  }
}

interface ExtensionAPI {
  storage?: ExtensionStorageAPI
}

/**
 * Interface for the extension storage state structure
 * This matches the Zustand persist format used by the extension
 */
interface ExtensionStorageState {
  state: {
    settings: {
      access_token?: string
      readspace_url?: string
      supabase_url?: string
      supabase_anon_key?: string
    }
  }
}

/**
 * Extension-specific API client that automatically configures itself for browser extension environments.
 *
 * This client extends the base ApiClient with automatic configuration:
 * - Automatically reads settings from chrome.storage
 * - Cross-browser support (Chrome/Firefox)
 * - Configures itself lazily on first API call
 * - Can be used directly without calling .create() or configure()
 *
 * @example
 * ```typescript
 * import { ApiExtensionClient } from '@/lib/api-client'
 *
 * // Direct usage - auto-configures on first call
 * const articles = await ApiExtensionClient.rss.getArticles({ page: 1 })
 * const folders = await ApiExtensionClient.rss.getFolders()
 * ```
 */
class ExtensionApiClient extends ApiClient {
  private static _configured = false
  private static _storageKey = 'readspace-extension'

  /**
   * Ensures the client is configured for extension environment before making API calls.
   * This method is called automatically before each request.
   */
  private static async _ensureConfigured(): Promise<void> {
    if (this._configured) {
      return
    }

    try {
      const extensionSettings = await this._getExtensionSettings()

      // Use settings from storage or fallback defaults
      const baseUrl = extensionSettings.readspace_url || 'https://api.readspace.ai'

      const getAuthToken: AuthTokenProvider = async () => {
        const settings = await this._getExtensionSettings()
        return settings.access_token || null
      }

      // Configure the base ApiClient
      const apiConfig: ApiClientConfig = {
        baseUrl,
        getAuthToken
      }

      super.configure(apiConfig)
      this._configured = true

    } catch (error) {
      console.error('Failed to auto-configure ApiExtensionClient:', error)

      // Fallback configuration to prevent blocking
      const fallbackConfig: ApiClientConfig = {
        baseUrl: 'https://api.readspace.ai',
        getAuthToken: async () => null
      }

      super.configure(fallbackConfig)
      this._configured = true
    }
  }

  /**
   * Reads extension settings from chrome.storage
   */
  private static async _getExtensionSettings(): Promise<{
    access_token?: string
    readspace_url?: string
    supabase_url?: string
    supabase_anon_key?: string
  }> {
    try {
      // Check if we're in a browser extension environment
      const chromeApi = (globalThis as unknown as { chrome?: ExtensionAPI }).chrome
      const browserApi = (globalThis as unknown as { browser?: ExtensionAPI }).browser

      if (!chromeApi && !browserApi) {
        console.debug('Not in browser extension environment, returning empty settings')
        return {}
      }

      // Use browser namespace for Firefox, chrome for Chrome
      const storageApi = (browserApi?.storage) ?
                        browserApi.storage :
                        (chromeApi?.storage) ?
                        chromeApi.storage :
                        null

      if (!storageApi?.local) {
        console.warn('Browser storage API not available')
        return {}
      }

      // Read from extension storage
      const result = await storageApi.local.get([this._storageKey])
      const storedData = result[this._storageKey] as ExtensionStorageState | undefined

      if (!storedData?.state?.settings) {
        return {}
      }

      return storedData.state.settings

    } catch (error) {
      console.error('Failed to read extension settings from storage:', error)
      return {}
    }
  }

  /**
   * Override the base fetch method to ensure auto-configuration before requests.
   */
  static async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    await this._ensureConfigured()
    return super.fetch<T>(endpoint, options)
  }

  /**
   * Override the base get method to ensure auto-configuration before requests.
   */
  static async get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    await this._ensureConfigured()
    return super.get<T>(endpoint, options)
  }

  /**
   * Override the base post method to ensure auto-configuration before requests.
   */
  static async post<T>(
    endpoint: string,
    data?: unknown,
    options?: RequestInit,
  ): Promise<T> {
    await this._ensureConfigured()
    return super.post<T>(endpoint, data, options)
  }

  /**
   * Override the base put method to ensure auto-configuration before requests.
   */
  static async put<T>(
    endpoint: string,
    data?: unknown,
    options?: RequestInit,
  ): Promise<T> {
    await this._ensureConfigured()
    return super.put<T>(endpoint, data, options)
  }

  /**
   * Override the base delete method to ensure auto-configuration before requests.
   */
  static async delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    await this._ensureConfigured()
    return super.delete<T>(endpoint, options)
  }

  /**
   * Override the base uploadFile method to ensure auto-configuration before requests.
   */
  static async uploadFile(
    endpoint: string,
    formData: FormData,
    signal?: AbortSignal,
  ): Promise<unknown> {
    await this._ensureConfigured()
    return super.uploadFile(endpoint, formData, signal)
  }

  /**
   * Force reconfiguration of the client.
   * Useful when extension settings have been updated and you want to reload them.
   */
  static async reconfigure(): Promise<void> {
    this._configured = false
    await this._ensureConfigured()
  }

  /**
   * Reset the configuration state. Useful for testing.
   */
  static resetConfiguration(): void {
    this._configured = false
  }

  /**
   * Check if the client has been configured.
   */
  static isConfigured(): boolean {
    return this._configured
  }
}

/**
 * Export the extension API client for use throughout the extension.
 * This client auto-configures itself on first use.
 */
export const ApiExtensionClient = ExtensionApiClient