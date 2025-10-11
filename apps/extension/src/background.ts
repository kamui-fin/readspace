// Background script for Readspace extension
import { browser, getBrowserName, identity } from '@/lib/browser'
import { trimSaveArticleRequest } from '@readspace/shared'
import { ApiClient } from '@/lib/api-client'
import type { Runtime } from 'webextension-polyfill'
import { extractOAuthTokens } from '@/lib/oauth'
import { getSupabaseClient } from '@/lib/supabase'

// Type for content extraction result
interface ContentExtractionResult {
  content?: string
  title?: string
  description?: string
  author?: string
  published_at?: string
  image_url?: string
}

// Type for page metadata response
interface PageMetadataResponse {
  feeds?: Array<{ url: string; title?: string; type: string }>
  title?: string
  description?: string
  author?: string
  published_at?: string
  image_url?: string
  favicon?: string
  canonical_url?: string
}

// Note: ApiExtensionClient auto-configures itself from extension storage

console.log(`Readspace background script loaded on ${getBrowserName()}`)

// ApiExtensionClient will auto-configure on first use

// Check if URL is supported (http/https)
function isSupportedUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://')
}

// Update badge with RSS feed count
async function updateFeedBadge(tabId: number, feedCount: number) {
  try {
    if (feedCount > 0) {
      // Try MV3 action API first (Chrome)
      try {
        await browser.action.setBadgeText({
          text: feedCount.toString(),
          tabId,
        })
        await browser.action.setBadgeBackgroundColor({
          color: '#FF6B35', // Orange color for RSS
          tabId,
        })
      } catch {
        // Fallback to MV2 browserAction API (Firefox)
        await browser.browserAction.setBadgeText({
          text: feedCount.toString(),
          tabId,
        })
        await browser.browserAction.setBadgeBackgroundColor({
          color: '#FF6B35', // Orange color for RSS
          tabId,
        })
        // Firefox supports text color
        try {
          await browser.browserAction.setBadgeTextColor({
            color: '#FFFFFF',
            tabId,
          })
        } catch {
          // Some versions might not support this
        }
      }
    } else {
      // Clear badge
      try {
        await browser.action.setBadgeText({ text: '', tabId })
      } catch {
        await browser.browserAction.setBadgeText({ text: '', tabId })
      }
    }
  } catch (error) {
    console.error('Failed to update badge:', error)
  }
}

// Handle OAuth callback from Google login
async function handleOAuthCallback(url: string, tabId: number) {
  try {
    console.log('OAuth callback detected:', url)

    // Extract tokens from URL
    const { access_token, refresh_token } = extractOAuthTokens(url)

    if (!access_token || !refresh_token) {
      throw new Error('No OAuth tokens found in callback URL')
    }

    console.log('OAuth tokens extracted successfully')

    // Get Supabase configuration from storage
    const storageData = await browser.storage.local.get('readspace-extension')
    const storeState = storageData['readspace-extension'] as {
      state?: { settings?: { supabase_url?: string; supabase_anon_key?: string } }
    }

    const supabaseUrl =
      storeState?.state?.settings?.supabase_url ||
      'https://hnqyngkyugiamvlhqoaf.supabase.co'
    const supabaseAnonKey =
      storeState?.state?.settings?.supabase_anon_key ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhucXluZ2t5dWdpYW12bGhxb2FmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAzODIwNDMsImV4cCI6MjA2NTk1ODA0M30.iu6pCWAX5ofuSumz6V0VwKNSEh88XDJ2RCC_iTln0xs'

    // Create Supabase client and set session
    const supabase = getSupabaseClient(supabaseUrl, supabaseAnonKey)

    if (!supabase) {
      throw new Error('Failed to initialize Supabase client')
    }

    // Set the session in Supabase
    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    })

    if (error) throw error

    console.log('OAuth session set successfully')

    // Store session in chrome.storage for persistence
    await browser.storage.local.set({
      'oauth-session': data.session,
    })

    // Send message to store to update with new access token
    // This will trigger the login flow in the extension store
    await browser.runtime.sendMessage({
      action: 'oauth-login-success',
      access_token,
    })

    // Close the OAuth tab
    await browser.tabs.remove(tabId)

    // Show success notification
    await browser.notifications.create('oauth-success', {
      type: 'basic',
      iconUrl: 'icons/icon-48.png',
      title: 'Readspace',
      message: 'Successfully signed in with Google!',
    })
  } catch (error) {
    console.error('OAuth callback error:', error)

    // Show error notification
    await browser.notifications.create('oauth-error', {
      type: 'basic',
      iconUrl: 'icons/icon-48.png',
      title: 'Readspace',
      message: `Failed to sign in with Google: ${error instanceof Error ? error.message : 'Unknown error'}`,
    })

    // Close the OAuth tab anyway
    try {
      await browser.tabs.remove(tabId)
    } catch (e) {
      console.error('Failed to close OAuth tab:', e)
    }
  }
}

// Check for RSS feeds when tab is updated
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Check for OAuth callback first
  if (changeInfo.url?.startsWith(identity.getRedirectURL())) {
    await handleOAuthCallback(changeInfo.url, tabId)
    return
  }

  if (changeInfo.status === 'complete' && tab.url && isSupportedUrl(tab.url)) {
    try {
      // Wait a bit for the page to fully load
      setTimeout(async () => {
        try {
          // Get full metadata which includes feeds
          const metadata = (await browser.tabs.sendMessage(tabId, {
            action: 'extractMetadata',
          })) as PageMetadataResponse

          const feedCount = metadata?.feeds?.length || 0
          console.log(
            `Found ${feedCount} feeds on tab ${tabId}:`,
            metadata?.feeds
          )

          await updateFeedBadge(tabId, feedCount)
        } catch (error) {
          // Content script might not be available yet, ignore error
          console.log(
            'Could not check for feeds, content script not available:',
            error
          )
          await updateFeedBadge(tabId, 0)
        }
      }, 2000) // Increased timeout to ensure content script is ready
    } catch (error) {
      console.error('Error checking for RSS feeds:', error)
    }
  } else {
    // Clear badge for non-supported URLs or incomplete loads
    await updateFeedBadge(tabId, 0)
  }
})

// Clear badge when switching tabs or navigating away from supported pages
browser.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await browser.tabs.get(activeInfo.tabId)
    if (!tab.url || !isSupportedUrl(tab.url)) {
      await updateFeedBadge(activeInfo.tabId, 0)
    }
  } catch (error) {
    console.error('Error handling tab activation:', error)
  }
})

// Context menu setup
browser.runtime.onInstalled.addListener(() => {
  // Extension installed
})

// Handle context menu clicks (removed)
// Context menu functionality removed

// Handle keyboard shortcuts
browser.commands.onCommand.addListener((command: string) => {
  browser.tabs
    .query({ active: true, currentWindow: true })
    .then((tabs: browser.Tabs.Tab[]) => {
      const tab = tabs[0]
      if (!tab?.id || !tab.url || !isSupportedUrl(tab.url)) {
        console.log('Keyboard shortcut used on unsupported page:', tab?.url)
        browser.notifications.create('unsupported-shortcut', {
          type: 'basic',
          iconUrl: 'icons/icon-48.png',
          title: 'Readspace',
          message:
            'This page type is not supported. Readspace only works on websites (http:// and https:// pages).',
        })
        return
      }

      switch (command) {
        case 'save-current-page':
          handleSaveToReadspace(tab.url || '', tab)
          break
        case 'open-readspace':
          handleOpenReadspace()
          break
      }
    })
})

// Handle messages from content script and popup
// Message request types
interface MessageRequest {
  action: string
  url?: string
  [key: string]: unknown
}

browser.runtime.onMessage.addListener(
  (
    request: unknown,
    sender: Runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => {
    const messageRequest = request as MessageRequest
    // Handle the async extractContent case
    if (messageRequest.action === 'extractContent') {
      if (sender.tab?.url && isSupportedUrl(sender.tab.url)) {
        handleExtractContent(sender.tab?.id, messageRequest.url)
          .then(sendResponse)
          .catch((error) => sendResponse({ error: error.message }))
        return true // Keep message channel open for async response
      } else {
        sendResponse({ error: 'Unsupported page type' })
        return true // Still return true even for error responses
      }
    }

    // Handle synchronous cases
    switch (messageRequest.action) {
      case 'saveArticle':
        if (sender.tab?.url && isSupportedUrl(sender.tab.url)) {
          handleSaveToReadspace(
            messageRequest.url || sender.tab.url,
            sender.tab
          )
        } else {
          console.log(
            'Save article requested from unsupported page:',
            sender.tab?.url
          )
        }
        break
      case 'discoverFeeds':
        if (sender.tab?.url && isSupportedUrl(sender.tab.url)) {
          handleDiscoverFeeds(sender.tab)
        } else {
          console.log(
            'Feed discovery requested from unsupported page:',
            sender.tab?.url
          )
        }
        break
    }
    // Return true for all message types to avoid type issues
    return true
  }
)

async function handleSaveToReadspace(url: string, tab?: browser.Tabs.Tab) {
  try {
    console.log('handleSaveToReadspace called with:', {
      url,
      tabId: tab?.id,
      tabTitle: tab?.title,
    })

    console.log('Saving article to Readspace...')

    console.log('Extracting content from page...')
    // Extract content from the page
    const content = await handleExtractContent(tab?.id, url)
    console.log('Content extraction result:', {
      hasContent: !!content,
      contentLength: content?.content?.length || 0,
      contentPreview: content?.content?.substring(0, 100) + '...',
      title: content?.title,
      description: content?.description,
      author: content?.author,
      fullContent: content,
    })

    const trimmedData = trimSaveArticleRequest({
      url,
      title: content?.title || tab?.title,
      content: content?.content,
      metadata: {
        description: content?.description,
        author: content?.author,
        published_at: content?.published_at,
        image_url: content?.image_url,
        favicon: tab?.favIconUrl,
      },
    })

    // Filter out undefined values from metadata for API client
    const requestBody = {
      ...trimmedData,
      metadata: trimmedData.metadata
        ? (Object.fromEntries(
            Object.entries(trimmedData.metadata).filter(
              ([_, value]) => value !== undefined
            )
          ) as Record<string, string>)
        : undefined,
    }

    console.log('Saving to Readspace API with request:', requestBody)

    // Save to Readspace API
    const responseData = await ApiClient.rss.saveArticle(requestBody)
    console.log('Article saved successfully:', responseData)

    browser.notifications.create('save-success', {
      type: 'basic',
      iconUrl: 'icons/icon-48.png',
      title: 'Readspace',
      message: 'Article saved successfully!',
    })
  } catch (error) {
    console.error('Failed to save article:', error)
    browser.notifications.create('save-error', {
      type: 'basic',
      iconUrl: 'icons/icon-48.png',
      title: 'Readspace',
      message: `Failed to save article: ${error instanceof Error ? error.message : 'Unknown error'}`,
    })
  }
}

async function handleExtractContent(
  tabId?: number,
  url?: string
): Promise<ContentExtractionResult | null> {
  if (!tabId) {
    console.log('handleExtractContent: no tabId provided')
    return null
  }

  try {
    console.log('handleExtractContent: sending message to content script', {
      tabId,
      url,
    })
    // Send message to content script to extract content
    const content = (await browser.tabs.sendMessage(tabId, {
      action: 'extractContent',
      url,
    })) as ContentExtractionResult
    console.log(
      'handleExtractContent: received response from content script:',
      content
    )
    return content
  } catch (error) {
    console.error('Failed to extract content:', error)
    return null
  }
}

async function handleDiscoverFeeds(tab?: browser.Tabs.Tab) {
  if (!tab?.id) return

  try {
    const feeds = (await browser.tabs.sendMessage(tab.id, {
      action: 'discoverFeeds',
    })) as Array<{ url: string; title?: string; type: string }>

    if (feeds?.length > 0) {
      // TODO: Show feed subscription interface
      console.log('Discovered feeds:', feeds)
    } else {
      browser.notifications.create('no-feeds', {
        type: 'basic',
        iconUrl: 'icons/icon-48.png',
        title: 'Readspace',
        message: 'No RSS feeds found on this page',
      })
    }
  } catch (error) {
    console.error('Failed to discover feeds:', error)
  }
}

async function handleOpenReadspace() {
  // Default to the main Readspace URL
  browser.tabs.create({ url: 'https://api.readspace.ai' })
}
