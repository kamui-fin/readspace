// Background script for Readspace extension
import { browser, getBrowserName, storage } from '@/lib/browser'
import { ApiClient, trimSaveArticleRequest } from '@readspace/shared'
import type { Runtime } from 'webextension-polyfill'


// Type for content extraction result
interface ContentExtractionResult {
  content?: string
  title?: string
  description?: string
  author?: string
  published_at?: string
  image_url?: string
}

// Configure API client for extension
async function getExtensionAuthToken(): Promise<string | null> {
  try {
    const settings = await storage.get('readspace-extension')
    const settingsData = (settings as any)?.state?.settings
    return settingsData?.access_token || null
  } catch (error) {
    console.warn('Failed to get auth token from extension storage:', error)
    return null
  }
}

async function getExtensionBaseUrl(): Promise<string> {
  try {
    const settings = await storage.get('readspace-extension')
    const settingsData = (settings as any)?.state?.settings
    return settingsData?.readspace_url || 'https://api.readspace.ai'
  } catch (error) {
    console.warn('Failed to get base URL from extension storage:', error)
    return 'https://api.readspace.ai'
  }
}

// Initialize API client with extension-specific configuration
async function initializeApiClient() {
  const baseUrl = await getExtensionBaseUrl()
  ApiClient.configure({
    baseUrl,
    getAuthToken: getExtensionAuthToken
  })
}

console.log(`Readspace background script loaded on ${getBrowserName()}`)

// Initialize API client when background script loads
initializeApiClient().catch(error => {
  console.error('Failed to initialize API client:', error)
})

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
          tabId 
        })
        await browser.action.setBadgeBackgroundColor({ 
          color: '#FF6B35', // Orange color for RSS
          tabId 
        })
      } catch {
        // Fallback to MV2 browserAction API (Firefox)
        await browser.browserAction.setBadgeText({ 
          text: feedCount.toString(), 
          tabId 
        })
        await browser.browserAction.setBadgeBackgroundColor({ 
          color: '#FF6B35', // Orange color for RSS
          tabId 
        })
        // Firefox supports text color
        try {
          await browser.browserAction.setBadgeTextColor({ 
            color: '#FFFFFF',
            tabId 
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

// Check for RSS feeds when tab is updated
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && isSupportedUrl(tab.url)) {
    try {
      // Wait a bit for the page to fully load
      setTimeout(async () => {
        try {
          // Get full metadata which includes feeds
          const metadata = await browser.tabs.sendMessage(tabId, { 
            action: 'extractMetadata' 
          }) as any
          
          const feedCount = metadata?.feeds?.length || 0
          console.log(`Found ${feedCount} feeds on tab ${tabId}:`, metadata?.feeds)
          
          await updateFeedBadge(tabId, feedCount)
        } catch (error) {
          // Content script might not be available yet, ignore error
          console.log('Could not check for feeds, content script not available:', error)
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
  browser.tabs.query({ active: true, currentWindow: true }).then((tabs: browser.Tabs.Tab[]) => {
    const tab = tabs[0]
    if (!tab?.id || !tab.url || !isSupportedUrl(tab.url)) {
      console.log('Keyboard shortcut used on unsupported page:', tab?.url)
      browser.notifications.create('unsupported-shortcut', {
        type: 'basic',
        iconUrl: 'icons/icon-48.png',
        title: 'Readspace',
        message: 'This page type is not supported. Readspace only works on websites (http:// and https:// pages).'
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
// @ts-ignore
browser.runtime.onMessage.addListener((request: any, sender: Runtime.MessageSender, sendResponse: (response?: any) => void): boolean | void => {
  // Handle the async extractContent case
  if (request.action === 'extractContent') {
    if (sender.tab?.url && isSupportedUrl(sender.tab.url)) {
      handleExtractContent(sender.tab?.id, request.url)
        .then(sendResponse)
        .catch(error => sendResponse({ error: error.message }))
      return true // Keep message channel open for async response
    } else {
      sendResponse({ error: 'Unsupported page type' })
      return // Synchronous response, don't return anything
    }
  }

  // Handle synchronous cases - these don't need to return anything
  switch (request.action) {
    case 'saveArticle':
      if (sender.tab?.url && isSupportedUrl(sender.tab.url)) {
        handleSaveToReadspace(request.url, sender.tab)
      } else {
        console.log('Save article requested from unsupported page:', sender.tab?.url)
      }
      break
    case 'discoverFeeds':
      if (sender.tab?.url && isSupportedUrl(sender.tab.url)) {
        handleDiscoverFeeds(sender.tab)
      } else {
        console.log('Feed discovery requested from unsupported page:', sender.tab?.url)
      }
      break
  }
  // No return statement for sync cases (implicitly returns undefined)
})

async function handleSaveToReadspace(url: string, tab?: browser.Tabs.Tab) {
  try {
    console.log('handleSaveToReadspace called with:', { url, tabId: tab?.id, tabTitle: tab?.title })
    
    // Check if user is authenticated
    const authToken = await getExtensionAuthToken()
    if (!authToken) {
      console.log('No access token found, showing authentication notification')
      browser.notifications.create('auth-required', {
        type: 'basic',
        iconUrl: 'icons/icon-48.png',
        title: 'Readspace',
        message: 'Please sign in to Readspace first'
      })
      return
    }

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
      fullContent: content
    })
    
    const requestBody = trimSaveArticleRequest({
      url,
      title: content?.title || tab?.title,
      content: content?.content,
      metadata: {
        description: content?.description,
        author: content?.author,
        published_at: content?.published_at,
        image_url: content?.image_url,
        favicon: tab?.favIconUrl
      }
    })
    
    console.log('Saving to Readspace API with request:', requestBody)

    // Save to Readspace API using shared client
    await initializeApiClient() // Ensure client is configured
    const responseData = await ApiClient.rss.saveArticle(requestBody)
    console.log('Article saved successfully:', responseData)

    browser.notifications.create('save-success', {
      type: 'basic',
      iconUrl: 'icons/icon-48.png',
      title: 'Readspace',
      message: 'Article saved successfully!'
    })
  } catch (error) {
    console.error('Failed to save article:', error)
    browser.notifications.create('save-error', {
      type: 'basic',
      iconUrl: 'icons/icon-48.png',
      title: 'Readspace',
      message: `Failed to save article: ${error instanceof Error ? error.message : 'Unknown error'}`
    })
  }
}

async function handleExtractContent(tabId?: number, url?: string): Promise<ContentExtractionResult | null> {
  if (!tabId) {
    console.log('handleExtractContent: no tabId provided')
    return null
  }

  try {
    console.log('handleExtractContent: sending message to content script', { tabId, url })
    // Send message to content script to extract content
    const content = await browser.tabs.sendMessage(tabId, { 
      action: 'extractContent',
      url 
    }) as ContentExtractionResult
    console.log('handleExtractContent: received response from content script:', content)
    return content
  } catch (error) {
    console.error('Failed to extract content:', error)
    return null
  }
}

async function handleDiscoverFeeds(tab?: browser.Tabs.Tab) {
  if (!tab?.id) return

  try {
    const feeds = await browser.tabs.sendMessage(tab.id, { 
      action: 'discoverFeeds' 
    }) as any[]
    
    if (feeds?.length > 0) {
      // TODO: Show feed subscription interface
      console.log('Discovered feeds:', feeds)
    } else {
      browser.notifications.create('no-feeds', {
        type: 'basic',
        iconUrl: 'icons/icon-48.png',
        title: 'Readspace',
        message: 'No RSS feeds found on this page'
      })
    }
  } catch (error) {
    console.error('Failed to discover feeds:', error)
  }
}

async function handleOpenReadspace() {
  try {
    const url = await getExtensionBaseUrl()
    browser.tabs.create({ url })
  } catch (error) {
    browser.tabs.create({ url: 'https://api.readspace.ai' })
  }
} 