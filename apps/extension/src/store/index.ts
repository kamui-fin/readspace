import { getSupabaseClient, resetSupabaseClient } from '@/lib/supabase'
import {
  ApiClient,
  Article,
  DiscoveredFeed,
  ExtensionSettings,
  Folder,
  PageMetadata,
  SaveOptions,
  User,
} from '@readspace/shared'
import toast from 'react-hot-toast'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ExtensionState {
  // Settings
  settings: ExtensionSettings
  updateSettings: (settings: Partial<ExtensionSettings>) => void

  // Authentication
  user: User | null
  isAuthenticated: boolean
  login: (accessToken: string) => Promise<void>
  logout: () => void
  updateToken: (accessToken: string) => void
  checkExistingSession: () => Promise<void>

  // Data
  folders: Folder[]

  // Loading states
  isLoading: boolean
  isConnecting: boolean
  isSaving: boolean

  // Current page data
  currentPageMetadata: PageMetadata | null

  // Actions
  setLoading: (loading: boolean) => void
  setConnecting: (connecting: boolean) => void
  setSaving: (saving: boolean) => void
  setCurrentPageMetadata: (metadata: PageMetadata | null) => void

  // API calls
  loadUserData: () => Promise<void>
  saveArticle: (url: string, options?: Partial<SaveOptions>) => Promise<Article>
  subscribeToFeed: (
    feedUrl: string,
    options?: { folder_id?: string }
  ) => Promise<void>
  subscribeToFeeds: (
    feeds: DiscoveredFeed[],
    options?: { folder_id?: string }
  ) => Promise<void>
}

const defaultSettings: ExtensionSettings = {
  readspace_url: 'https:///api.readspace.ai',
  supabase_url: 'https:///hnqyngkyugiamvlhqoaf.supabase.co',
  supabase_anon_key:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhucXluZ2t5dWdpYW12bGhxb2FmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAzODIwNDMsImV4cCI6MjA2NTk1ODA0M30.iu6pCWAX5ofuSumz6V0VwKNSEh88XDJ2RCC_iTln0xs',
  auto_save: false,
  show_reading_time: true,
  theme: 'system',
}

// Configure API client with current settings and token
const configureApiClient = (settings: ExtensionSettings) => {
  ApiClient.configure({
    baseUrl: settings.readspace_url,
    getAuthToken: async () => {
      return settings.access_token || null
    },
  })
}

export const useExtensionStore = create<ExtensionState>()(
  persist(
    (set, get) => ({
      // Initial state
      settings: defaultSettings,
      user: null,
      isAuthenticated: false,
      folders: [],
      isLoading: false,
      isConnecting: false,
      isSaving: false,
      currentPageMetadata: null,

      // Settings
      updateSettings: async (newSettings) => {
        const settings = { ...get().settings, ...newSettings }
        set({ settings })

        // Reconfigure API client if URL or token changed
        if (newSettings.readspace_url || newSettings.access_token) {
          configureApiClient(settings)
        }

        // Reset Supabase client if settings changed to force recreation with new settings
        if (newSettings.supabase_url || newSettings.supabase_anon_key) {
          resetSupabaseClient()
          console.log('Supabase client reset for new settings')
        }
      },

      // Authentication
      checkExistingSession: async () => {
        const { settings } = get()

        // Don't check session if Supabase is not configured
        if (!settings.supabase_url || !settings.supabase_anon_key) {
          return
        }

        try {
          console.log('Checking existing session...')
          const supabase = getSupabaseClient(
            settings.supabase_url,
            settings.supabase_anon_key
          )

          if (!supabase) {
            console.log('Failed to create Supabase client')
            return
          }

          const {
            data: { session },
            error,
          } = await supabase.auth.getSession()

          if (error) {
            console.error('Session check failed:', error)
            return
          }

          if (session?.access_token) {
            console.log('Found existing session, logging in...')
            await get().login(session.access_token)
          } else {
            console.log('No existing session found')
          }
        } catch (error) {
          console.error('Failed to check existing session:', error)
        }
      },

      login: async (accessToken: string) => {
        set({ isConnecting: true })
        try {
          const { settings } = get()
          const updatedSettings = { ...settings, access_token: accessToken }

          // Configure API client with new token
          configureApiClient(updatedSettings)

          // Test authentication by getting user profile
          const user = (await ApiClient.users.getProfile()) as User

          set({
            user,
            isAuthenticated: true,
            settings: updatedSettings,
            isConnecting: false,
          })

          // Load initial data
          await get().loadUserData()
        } catch (error) {
          set({ isConnecting: false })
          const errorMessage =
            error instanceof Error ? error.message : 'Authentication failed'
          console.error('Login failed:', error)
          throw new Error(errorMessage)
        }
      },

      logout: () => {
        const { settings } = get()

        // Sign out from Supabase with local scope to avoid affecting other apps
        const supabase = getSupabaseClient(
          settings.supabase_url,
          settings.supabase_anon_key
        )
        if (supabase) {
          supabase.auth.signOut({ scope: 'local' }).catch((error) => {
            console.error('Failed to sign out from Supabase:', error)
          })
        }

        const updatedSettings = { ...get().settings, access_token: undefined }

        set({
          user: null,
          isAuthenticated: false,
          folders: [],
          settings: updatedSettings,
        })

        // Reconfigure API client without token
        configureApiClient(updatedSettings)
      },

      updateToken: (accessToken: string) => {
        const { settings } = get()
        const updatedSettings = { ...settings, access_token: accessToken }

        // Update settings
        set({ settings: updatedSettings })

        // Reconfigure API client with new token
        configureApiClient(updatedSettings)
      },

      // Loading states
      setLoading: (loading) => set({ isLoading: loading }),
      setConnecting: (connecting) => set({ isConnecting: connecting }),
      setSaving: (saving) => set({ isSaving: saving }),
      setCurrentPageMetadata: (metadata) =>
        set({ currentPageMetadata: metadata }),

      // Data loading
      loadUserData: async () => {
        const { isAuthenticated } = get()
        if (!isAuthenticated) return

        set({ isLoading: true })
        try {
          const folders = (await ApiClient.rss.getFolders()) as Folder[]

          set({ folders })
        } catch (error) {
          console.error('Failed to load user data:', error)
          toast.error('Failed to load user data. Please try again.')
        } finally {
          set({ isLoading: false })
        }
      },

      saveArticle: async (url: string, options = {}) => {
        const { isAuthenticated, currentPageMetadata } = get()
        if (!isAuthenticated) throw new Error('Not authenticated')

        set({ isSaving: true })
        try {
          // Extract content from the current page
          console.log('Extracting content for article save...')
          let extractedContent = null

          try {
            // Get current tab to extract content
            const tabs = await chrome.tabs.query({
              active: true,
              currentWindow: true,
            })
            if (tabs[0]?.id) {
              extractedContent = await chrome.tabs.sendMessage(tabs[0].id, {
                action: 'extractContent',
                url,
              })
              console.log('Content extracted from page:', extractedContent)
            }
          } catch (error) {
            console.error('Failed to extract content from page:', error)
          }

          // Build metadata object with only defined string values
          const metadata: Record<string, string> = {}
          const description =
            extractedContent?.description || currentPageMetadata?.description
          const author = extractedContent?.author || currentPageMetadata?.author
          const published_at =
            extractedContent?.published_at || currentPageMetadata?.published_at
          const image_url =
            extractedContent?.image_url || currentPageMetadata?.image_url
          const favicon = currentPageMetadata?.favicon

          if (description) metadata.description = description
          if (author) metadata.author = author
          if (published_at) metadata.published_at = published_at
          if (image_url) metadata.image_url = image_url
          if (favicon) metadata.favicon = favicon

          const saveRequest = {
            url,
            title:
              options.title ||
              extractedContent?.title ||
              currentPageMetadata?.title,
            content: extractedContent?.content, // Include the extracted HTML content
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
          }

          console.log('Saving article with request:', {
            ...saveRequest,
            content: saveRequest.content
              ? `${saveRequest.content.length} chars`
              : 'no content',
          })

          const article = (await ApiClient.rss.saveArticle(
            saveRequest
          )) as Article
          return article
        } finally {
          set({ isSaving: false })
        }
      },

      subscribeToFeed: async (feedUrl: string, options = {}) => {
        const { isAuthenticated, settings } = get()
        if (!isAuthenticated) {
          toast.error('Please sign in to subscribe to feeds')
          throw new Error('Not authenticated')
        }

        try {
          await ApiClient.rss.createFeed({
            url: feedUrl,
            folder_id: options.folder_id || settings.default_folder_id,
          })
        } catch (error) {
          console.error('Failed to subscribe to feed:', error)
          const errorMessage =
            error instanceof Error
              ? error.message
              : 'Failed to subscribe to feed'
          throw new Error(errorMessage)
        }
      },

      subscribeToFeeds: async (feeds: DiscoveredFeed[], options = {}) => {
        const { isAuthenticated, settings } = get()
        if (!isAuthenticated) {
          toast.error('Please sign in to subscribe to feeds')
          throw new Error('Not authenticated')
        }

        try {
          // Subscribe to feeds one by one since there's no bulk endpoint in the current API
          await Promise.all(
            feeds.map((feed) =>
              ApiClient.rss.createFeed({
                url: feed.url,
                folder_id: options.folder_id || settings.default_folder_id,
              })
            )
          )
        } catch (error) {
          console.error('Failed to subscribe to feeds:', error)
          const errorMessage =
            error instanceof Error
              ? error.message
              : 'Failed to subscribe to feeds'
          throw new Error(errorMessage)
        }
      },
    }),
    {
      name: 'readspace-extension',
      partialize: (state) => ({
        settings: state.settings,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        folders: state.folders,
      }),
      onRehydrateStorage: () => (state) => {
        if (
          state?.isAuthenticated &&
          state?.settings?.access_token &&
          state?.settings?.readspace_url
        ) {
          // Configure API client on rehydration
          configureApiClient(state.settings)
          console.log(
            'API client configured on rehydration with token',
            state.settings.access_token
          )
        }
      },
    }
  )
)
