
import { sendMessage } from '@/shared/messaging'
import browser from 'webextension-polyfill'
import { ExtensionSettings } from '@/types'
import { PageMetadata, User } from '@readspace/shared'
import { create } from 'zustand'
import { createJSONStorage, persist, StateStorage } from 'zustand/middleware'
import { PRODUCTION_DEFAULTS } from '@/lib/constants'

interface ExtensionState {
  // Settings
  settings: ExtensionSettings
  updateSettings: (settings: Partial<ExtensionSettings>) => void

  // Authentication
  user: User | null
  isAuthenticated: boolean
  login: () => Promise<void>
  logout: () => Promise<void>
  checkExistingSession: () => Promise<void>

  // Loading states
  isConnecting: boolean

  // Current page data
  currentPageMetadata: PageMetadata | null

  // Actions
  setConnecting: (connecting: boolean) => void
  setCurrentPageMetadata: (metadata: PageMetadata | null) => void
}

const defaultSettings: ExtensionSettings = {
  readspace_url: PRODUCTION_DEFAULTS.readspace_url,
  supabase_url: PRODUCTION_DEFAULTS.supabase_url,
  supabase_anon_key: PRODUCTION_DEFAULTS.supabase_anon_key,
  google_client_id: PRODUCTION_DEFAULTS.google_client_id,
  auto_save: false,
  show_reading_time: true,
  theme: 'system',
}

// Custom storage adapter for browser extensions
const extensionStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const result = await browser.storage.local.get(name)
      const value = result[name]
      return typeof value === 'string' ? value : null
    } catch (error) {
      console.error('Error reading from extension storage:', error)
      return null
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await browser.storage.local.set({ [name]: value })
    } catch (error) {
      console.error('Error writing to extension storage:', error)
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await browser.storage.local.remove(name)
    } catch (error) {
      console.error('Error removing from extension storage:', error)
    }
  },
}

export const useExtensionStore = create<ExtensionState>()(
  persist(
    (set, get) => ({
      // Initial state
      settings: defaultSettings,
      user: null,
      isAuthenticated: false,
      isConnecting: false,
      currentPageMetadata: null,

      // Settings
      updateSettings: async (newSettings) => {
        const settings = { ...get().settings, ...newSettings }
        set({ settings })

        // Reconfigure API client if URL changed
        if (newSettings.readspace_url || newSettings.supabase_url) {
          sendMessage({ type: 'config-changed' }).catch(console.error)
        }
      },

      // Authentication
      checkExistingSession: async () => {
        try {
          // Just check if we have a session in storage, which is managed by background
          const result = await browser.storage.local.get('session')
          const session = result.session as { access_token?: string } | undefined

          if (session?.access_token) {
            // If we have a token but no user profile, fetch it
            if (!get().user) {
              await get().login()
            }
          }
        } catch (error) {
          console.error('Failed to check existing session:', error)
        }
      },

      login: async () => {
        set({ isConnecting: true })
        try {
          // Get profile via background script
          const user = await sendMessage({ type: 'getProfile' })

          set({
            user,
            isAuthenticated: true,
            isConnecting: false,
          })
        } catch (error) {
          set({ isConnecting: false })
          // If getProfile fails, it likely means our token is invalid
          // We should probably clear the session in that case, but for now just log
          console.error('Login failed (fetch profile):', error)
        }
      },

      logout: async () => {
        try {
          // Tell background to sign out
          await sendMessage({ type: 'logout' })
        } catch (error) {
          console.error('Failed to send logout message:', error)
        }

        set({
          user: null,
          isAuthenticated: false,
        })
      },

      // Loading states
      setConnecting: (connecting) => set({ isConnecting: connecting }),
      setCurrentPageMetadata: (metadata) =>
        set({ currentPageMetadata: metadata }),
    }),
    {
      name: 'readspace-extension',
      storage: createJSONStorage(() => extensionStorage),
      partialize: (state) => ({
        settings: state.settings,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // Check for existing Supabase session on startup
        if (state) {
          state.checkExistingSession()
        }
      },
    }
  )
)

// Listen for auth changes from background
browser.runtime.onMessage.addListener((msg: any) => {
  if (msg.type === "auth-changed") {
    const session = msg.payload;
    const store = useExtensionStore.getState();

    if (session) {
      // If we have a session but aren't authenticated in store, try to login (get profile)
      if (!store.isAuthenticated) {
        store.login().catch(console.error);
      }
    } else {
      // If no session, ensure we are logged out
      if (store.isAuthenticated) {
        store.logout().catch(console.error);
      }
    }
  }
});
