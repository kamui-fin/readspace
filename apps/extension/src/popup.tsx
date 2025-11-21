import { browser } from '@/lib/browser'
import type { PageMetadata } from '@readspace/shared'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import {
  AlertTriangle,
  ExternalLink,
  Settings as SettingsIcon,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import { ArticlePreview } from './components/ArticlePreview'
import { FeedDiscoveryCard } from './components/FeedDiscoveryCard'
import { LoginForm } from './components/LoginForm'
import { Settings } from './components/Settings'
import ThemeSwitcher from './components/ThemeSwitcher'
import { Button } from './components/ui/button'
import './index.css'
import { createChromeStoragePersister } from './lib/query-persister'
import { useExtensionStore } from './store'

// Create a client with persistence-friendly settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 60 * 24, // 24 hours - must be >= maxAge for persistence
      retry: 1,
    },
  },
})

// Create the Chrome storage persister
const persister = createChromeStoragePersister('readspace-query-cache', {
  throttleTime: 2000, // Throttle writes to every 2 seconds
  debug: false, // Set to true for debugging
})

function ThemedToaster() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <Toaster position="top-center" />
  }

  return (
    <Toaster
      position="top-center"
      toastOptions={{
        duration: 3000,
        style: {
          background: 'hsl(var(--background))',
          color: 'hsl(var(--foreground))',
          border: '1px solid hsl(var(--border))',
          fontSize: '14px',
          maxWidth: '350px',
        },
        success: {
          style: {
            background: 'hsl(var(--background))',
            color: 'hsl(var(--foreground))',
            border: '1px solid hsl(var(--border))',
          },
          iconTheme: {
            primary: 'hsl(var(--primary))',
            secondary: 'hsl(var(--primary-foreground))',
          },
        },
        error: {
          style: {
            background: 'hsl(var(--background))',
            color: 'hsl(var(--foreground))',
          },
          iconTheme: {
            primary: 'hsl(var(--destructive))',
            secondary: 'hsl(var(--destructive-foreground))',
          },
        },
        loading: {
          style: {
            background: 'hsl(var(--background))',
            color: 'hsl(var(--foreground))',
            border: '1px solid hsl(var(--border))',
          },
        },
      }}
    />
  )
}

function PopupContent() {
  const {
    isAuthenticated,
    settings,
    currentPageMetadata,
    setCurrentPageMetadata,
    checkExistingSession,
    loadUserData,
  } = useExtensionStore()

  const [currentView, setCurrentView] = useState<'main' | 'settings' | 'login'>(
    'main'
  )
  const [currentTab, setCurrentTab] = useState<chrome.tabs.Tab | null>(null)
  const [readingTime, setReadingTime] = useState<number | undefined>()
  const [isUnsupportedPage, setIsUnsupportedPage] = useState(false)
  const [isMetadataLoading, setIsMetadataLoading] = useState(true)
  const [isFeedDataLoading, setIsFeedDataLoading] = useState(true)

  const extractPageMetadata = useCallback(
    async (tab: chrome.tabs.Tab) => {
      if (!tab.id || !tab.url) return

      // Immediately show basic tab info - don't block the UI
      setCurrentPageMetadata({
        title: tab.title,
        canonical_url: tab.url,
        favicon: tab.favIconUrl,
      })
      setIsMetadataLoading(false)
      setIsFeedDataLoading(false)

      // Try to get cached page data by URL from persistent cache
      let foundCacheWithFeeds = false
      try {
        const cachedPage = await chrome.runtime.sendMessage({
          action: 'getCachedPageByUrl',
          url: tab.url,
        })

        if (cachedPage) {
          // If we have cached metadata, use it immediately
          if (cachedPage.metadata) {
            setCurrentPageMetadata(cachedPage.metadata)
            // Check if we have feeds in cache
            if (
              cachedPage.metadata.feeds &&
              cachedPage.metadata.feeds.length > 0
            ) {
              foundCacheWithFeeds = true
            }
          }

          // If we have cached content with reading time, use it immediately
          if (cachedPage.content?.estimated_read_time) {
            setReadingTime(cachedPage.content.estimated_read_time)
          }
        }
      } catch {
        // No cached page data available
      }

      // Also try legacy tabId-based cache as fallback (for current tab before it's cached by URL)
      if (!foundCacheWithFeeds) {
        try {
          const cachedMetadata = await chrome.runtime.sendMessage({
            action: 'getCachedMetadata',
            tabId: tab.id,
          })

          if (cachedMetadata) {
            setCurrentPageMetadata(cachedMetadata)
            // Check if we have feeds in legacy cache
            if (cachedMetadata.feeds && cachedMetadata.feeds.length > 0) {
              foundCacheWithFeeds = true
            }
          }
        } catch {
          // No legacy cached metadata available
        }

        // Also try legacy content cache for reading time
        try {
          const cachedContent = await chrome.runtime.sendMessage({
            action: 'getCachedContent',
            tabId: tab.id,
          })

          if (cachedContent?.estimated_read_time) {
            setReadingTime(cachedContent.estimated_read_time)
          }
        } catch {
          // No legacy cached content available
        }
      }

      // If we found cache with feeds, we're done - don't extract again
      // But if cache has no feeds, still try to discover them fresh
      if (foundCacheWithFeeds) {
        return
      }

      // No cache found - extract metadata in background (non-blocking)
      const sendMessage = <T,>(action: string, timeout = 5000): Promise<T> => {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(
              new Error(`Timeout: ${action} took longer than ${timeout}ms`)
            )
          }, timeout)

          chrome.tabs.sendMessage(tab.id!, { action }, (response) => {
            clearTimeout(timer)
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message))
            } else {
              resolve(response)
            }
          })
        })
      }

      // Extract metadata in background - don't block UI
      sendMessage<PageMetadata>('extractMetadata', 3000)
        .then((metadata) => {
          if (metadata) {
            setCurrentPageMetadata(metadata)
          }
        })
        .catch(() => {
          // Don't show error - we already have basic tab info displayed
        })

      // Extract content in background for reading time - don't block UI
      sendMessage<{ estimated_read_time?: number }>('extractContent', 10000)
        .then((contentData) => {
          if (contentData?.estimated_read_time) {
            setReadingTime(contentData.estimated_read_time)
          }
        })
        .catch(() => {
          // Don't show error - reading time is optional
        })
    },
    [setCurrentPageMetadata]
  )

  useEffect(() => {
    // Check for existing session on load
    checkExistingSession()

    // Refresh user data (feeds, folders) to sync with webapp changes
    // This ensures that if a feed was unfollowed in the webapp, it reflects here
    if (isAuthenticated) {
      loadUserData()
    }

    // Get current tab information
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        setCurrentTab(tabs[0])

        // Check if the URL is supported (http/https)
        const url = tabs[0].url
        if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
          setIsUnsupportedPage(true)
          return
        }

        setIsUnsupportedPage(false)
        // Extract metadata from current page
        extractPageMetadata(tabs[0])
      }
    })
  }, [checkExistingSession, extractPageMetadata, isAuthenticated, loadUserData])

  const openReadspace = () => {
    // Use the app URL, not the API URL
    const appUrl =
      settings.readspace_url === 'https://api.readspace.ai'
        ? 'https://app.readspace.ai'
        : settings.readspace_url.replace('/api', '') // For self-hosted, remove /api if present
    chrome.tabs.create({ url: appUrl })
  }

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="w-[450px] min-h-[500px] p-6">
        {currentView === 'settings' ? (
          <Settings onBack={() => setCurrentView('main')} />
        ) : (
          <div className="space-y-6">
            {/* Logo and Title */}
            <div className="text-center mb-2">
              <div className="flex items-center justify-center mb-4">
                <div className="w-12 h-12">
                  <img
                    src={browser.runtime.getURL('assets/readspace.svg')}
                    alt="Readspace"
                    className="w-full h-full rounded"
                  />
                </div>
              </div>
              <h1 className="text-lg font-semibold">Sign in to Readspace</h1>
            </div>

            {/* Embedded Login Form */}
            <LoginForm onShowSelfHosted={() => setCurrentView('settings')} />

            {/* New to Readspace link */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                New to Readspace?{' '}
                <button
                  onClick={() =>
                    window.open('https://app.readspace.ai/signup', '_blank')
                  }
                  className="text-primary hover:underline font-medium"
                >
                  Create account
                </button>
              </p>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Show unsupported page message (only when authenticated)
  if (isUnsupportedPage) {
    return (
      <div className="w-[450px] min-h-[500px] p-6">
        <div className="text-center space-y-4">
          {/* Unsupported page message */}
          <div className="space-y-3">
            <div className="flex justify-center">
              <AlertTriangle className="w-16 h-16 text-amber-500" />
            </div>
            <h2 className="text-lg font-semibold">Page Not Supported</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Readspace extension only works on websites (http:// and https://
              pages). This page type is not supported for saving articles.
            </p>
            <div className="pt-2">
              <p className="text-xs text-muted-foreground">
                Current page:{' '}
                <span className="font-mono text-xs">
                  {currentTab?.url?.substring(0, 50)}...
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Settings overlay */}
        {currentView === 'settings' && (
          <div className="absolute inset-0 bg-background">
            <Settings onBack={() => setCurrentView('main')} />
          </div>
        )}
      </div>
    )
  }

  // Main authenticated view
  return (
    <div className="w-[450px] min-h-[500px] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5">
            <img
              src={browser.runtime.getURL('assets/readspace.svg')}
              alt="Readspace"
              className="w-full h-full"
            />
          </div>
          <h1
            className="font-semibold text-lg"
            style={{ fontFamily: 'Figtree' }}
          >
            readspace
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={openReadspace}
              className="h-8 w-8 p-0"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentView('settings')}
              className="h-8 w-8 p-0"
            >
              <SettingsIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {currentView === 'settings' ? (
        <Settings onBack={() => setCurrentView('main')} />
      ) : (
        <div className="space-y-4">
          {/* RSS Feed Discovery Card - Show skeleton while loading or if feeds exist */}
          {(isFeedDataLoading ||
            (currentPageMetadata?.feeds &&
              currentPageMetadata.feeds.length > 0)) && (
            <FeedDiscoveryCard
              feeds={currentPageMetadata?.feeds}
              websiteTitle={currentPageMetadata?.title}
              isLoading={isFeedDataLoading}
            />
          )}

          {/* Current Page Preview - Always show, with skeleton while loading */}
          <ArticlePreview
            metadata={currentPageMetadata || undefined}
            isMetadataLoading={isMetadataLoading}
            readingTime={readingTime}
            currentUrl={currentTab?.url}
          />
        </div>
      )}
    </div>
  )
}

// Wrapper component to use PersistQueryClientProvider
export function Popup() {
  return <PopupContent />
}

// Initialize the popup
const container = document.getElementById('root')
if (container) {
  const root = createRoot(container)
  root.render(
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
        buster: '', // Can be used for cache invalidation on extension updates
      }}
    >
      <Popup />
      <ThemedToaster />
    </PersistQueryClientProvider>
  )
}
