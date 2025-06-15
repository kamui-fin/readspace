import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  ExtensionSettings,
  User,
  Article,
  Folder,
  Tag,
  SaveOptions,
  PageMetadata,
  DiscoveredFeed,
} from '@/types'
import { ReadspaceAPI } from '@/lib/api'
import { SupabaseAuthService } from '@/lib/supabase-auth'

interface ExtensionState {
  // Settings
  settings: ExtensionSettings
  updateSettings: (settings: Partial<ExtensionSettings>) => void

  // Authentication
  user: User | null
  isAuthenticated: boolean
  api: ReadspaceAPI | null
  login: (accessToken: string) => Promise<void>
  logout: () => void
  updateToken: (accessToken: string) => void

  // Data
  folders: Folder[]
  tags: Tag[]
  
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
  subscribeToFeed: (feedUrl: string, options?: { folder_id?: string; tag_ids?: string[] }) => Promise<void>
  subscribeToFeeds: (feeds: DiscoveredFeed[], options?: { folder_id?: string; tag_ids?: string[] }) => Promise<void>
}

const defaultSettings: ExtensionSettings = {
  readspace_url: 'http://0.0.0.0:8008',
  supabase_url: 'http://localhost:54321',
  supabase_anon_key: '',
  auto_save: false,
  show_reading_time: true,
  theme: 'system',
  default_tags: [],
}

export const useExtensionStore = create<ExtensionState>()(
  persist(
    (set, get) => ({
      // Initial state
      settings: defaultSettings,
      user: null,
      isAuthenticated: false,
      api: null,
      folders: [],
      tags: [],
      isLoading: false,
      isConnecting: false,
      isSaving: false,
      currentPageMetadata: null,

      // Settings
      updateSettings: (newSettings) => {
        const settings = { ...get().settings, ...newSettings }
        set({ settings })
        
        // Update API instance if URL changed
        const { api } = get()
        if (api && newSettings.readspace_url && newSettings.readspace_url !== api['baseUrl']) {
          const newApi = new ReadspaceAPI(settings.readspace_url, settings.access_token)
          set({ api: newApi })
        }
      },

      // Authentication
      login: async (accessToken: string) => {
        set({ isConnecting: true })
        try {
          const { settings } = get()
          
          // Create authenticated API instance and test it
          const api = new ReadspaceAPI(settings.readspace_url, accessToken)
          const user = await api.getCurrentUser()
          
          set({
            user,
            isAuthenticated: true,
            api,
            settings: { ...settings, access_token: accessToken },
            isConnecting: false,
          })

          // Initialize auth service for token refresh
          const authService = SupabaseAuthService.getInstance()
          await authService.initialize()

          // Load initial data
          await get().loadUserData()
        } catch (error) {
          set({ isConnecting: false })
          throw error
        }
      },

      logout: () => {
        // Destroy auth service
        const authService = SupabaseAuthService.getInstance()
        authService.destroy()
        
        set({
          user: null,
          isAuthenticated: false,
          api: null,
          folders: [],
          tags: [],
          settings: { ...get().settings, access_token: undefined },
        })
      },

      updateToken: (accessToken: string) => {
        const { settings, api } = get()
        const updatedSettings = { ...settings, access_token: accessToken }
        
        // Update settings
        set({ settings: updatedSettings })
        
        // Update API instance with new token
        if (api) {
          api.setAccessToken(accessToken)
        }
      },

      // Loading states
      setLoading: (loading) => set({ isLoading: loading }),
      setConnecting: (connecting) => set({ isConnecting: connecting }),
      setSaving: (saving) => set({ isSaving: saving }),
      setCurrentPageMetadata: (metadata) => set({ currentPageMetadata: metadata }),

      // Data loading
      loadUserData: async () => {
        const { api } = get()
        if (!api) return

        set({ isLoading: true })
        try {
          const [folders, tags] = await Promise.all([
            api.getFolders(),
            api.getTags(),
          ])

          set({ folders, tags })
        } catch (error) {
          console.error('Failed to load user data:', error)
        } finally {
          set({ isLoading: false })
        }
      },

      saveArticle: async (url: string, options = {}) => {
        const { api, settings, currentPageMetadata } = get()
        if (!api) throw new Error('Not authenticated')

        set({ isSaving: true })
        try {
          // Extract content from the current page
          console.log('Extracting content for article save...')
          let extractedContent = null
          
          try {
            // Get current tab to extract content
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
            if (tabs[0]?.id) {
              extractedContent = await chrome.tabs.sendMessage(tabs[0].id, { 
                action: 'extractContent',
                url 
              })
              console.log('Content extracted from page:', extractedContent)
            }
          } catch (error) {
            console.error('Failed to extract content from page:', error)
          }

          const saveRequest = {
            url,
            title: options.title || extractedContent?.title || currentPageMetadata?.title,
            content: extractedContent?.content, // Include the extracted HTML content
            metadata: {
              description: extractedContent?.description || currentPageMetadata?.description,
              author: extractedContent?.author || currentPageMetadata?.author,
              published_at: extractedContent?.published_at || currentPageMetadata?.published_at,
              image_url: extractedContent?.image_url || currentPageMetadata?.image_url,
              favicon: currentPageMetadata?.favicon,
            },
            priority: options.priority,
            tag_ids: options.tag_ids?.length ? options.tag_ids : settings.default_tags,
            note: options.note,
          }
          
          console.log('Saving article with request:', {
            ...saveRequest,
            content: saveRequest.content ? `${saveRequest.content.length} chars` : 'no content'
          })

          const article = await api.saveArticle(saveRequest)
          return article
        } finally {
          set({ isSaving: false })
        }
      },

      subscribeToFeed: async (feedUrl: string, options = {}) => {
        const { api, settings } = get()
        if (!api) throw new Error('Not authenticated')

        await api.createFeed({
          url: feedUrl,
          folder_id: options.folder_id || settings.default_folder_id,
          tag_ids: options.tag_ids || settings.default_tags,
        })
      },

      subscribeToFeeds: async (feeds: DiscoveredFeed[], options = {}) => {
        const { api, settings } = get()
        if (!api) throw new Error('Not authenticated')

        const subscribeRequest = {
          feeds: feeds.map(feed => ({
            url: feed.url,
            folder_id: options.folder_id || settings.default_folder_id,
            tag_ids: options.tag_ids || settings.default_tags,
          }))
        }

        await api.subscribeToFeeds(subscribeRequest)
      },
    }),
    {
      name: 'readspace-extension',
      partialize: (state) => ({
        settings: state.settings,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        folders: state.folders,
        tags: state.tags,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.isAuthenticated && state?.settings?.access_token && state?.settings?.readspace_url) {
          // Recreate API instance on rehydration
          const api = new ReadspaceAPI(state.settings.readspace_url, state.settings.access_token)
          state.api = api
          console.log('API instance recreated on rehydration')
        }
      },
    }
  )
) 