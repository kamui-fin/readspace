import { ApiClient, ClientProvider, type AuthTokenProvider } from "@readspace/shared"
import { createClient } from "@/lib/supabase/client"
import { env } from "@/env"

/**
 * Web-specific API client that automatically configures itself for browser environments.
 *
 * This client extends the base ApiClient with automatic configuration:
 * - Automatically detects and uses Supabase client for authentication
 * - Auto-detects API base URL from Next.js environment variables
 * - Configures itself lazily on first API call
 * - Can be used directly without calling .create() or configure()
 *
 * @example
 * ```typescript
 * import { ApiWebClient } from '@/lib/api-client'
 *
 * // Direct usage - auto-configures on first call
 * const articles = await ApiWebClient.rss.getArticles({ page: 1 })
 * const folders = await ApiWebClient.rss.getFolders()
 * ```
 */
class WebApiClient extends ApiClient {
  private static _configured = false

  /**
   * Ensures the client is configured for web environment before making API calls.
   * This method is called automatically before each request.
   */
  private static async _ensureConfigured(): Promise<void> {
    if (this._configured) {
      return
    }

    // Environment detection - only works in browser environments
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      throw new Error(
        'ApiWebClient can only be used in browser environments. Use the base ApiClient for server-side usage.'
      )
    }

    try {
      // Use Next.js environment variable for base URL
      const baseUrl = env.NEXT_PUBLIC_API_BASE_URL

      // Create auth token provider using Supabase client
      const getAuthToken: AuthTokenProvider = async (): Promise<string | null> => {
        try {
          const supabase = createClient()
          const { data: { session }, error } = await supabase.auth.getSession()

          if (error) {
            console.warn('Failed to get session:', error.message)
            return null
          }

          if (!session) {
            return null
          }

          return session.access_token
        } catch (err) {
          console.error('Error getting auth token:', err)
          return null
        }
      }

      // Configure the base ApiClient
      super.configure({
        baseUrl,
        getAuthToken,
      })

      this._configured = true

      // Register this client with the ClientProvider so shared hooks can use it
      ClientProvider.setClient(this)
    } catch (error) {
      console.error('Failed to auto-configure ApiWebClient:', error)
      throw new Error(
        'ApiWebClient auto-configuration failed. Please ensure environment variables are properly set.'
      )
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
   * Reset the configuration state. Useful for testing or when you need to
   * reconfigure the client with different settings.
   */
  static resetConfiguration(): void {
    this._configured = false
    ClientProvider.reset()
  }

  /**
   * Check if the client has been configured.
   */
  static isConfigured(): boolean {
    return this._configured
  }
}

/**
 * Export the web API client for use throughout the application.
 * This client auto-configures itself on first use.
 */
export const ApiWebClient = WebApiClient