// Background script for Readspace extension
import { browser, getBrowserName, storage } from '@/lib/browser'
import type { Menus, Runtime } from 'webextension-polyfill'


// Type for content extraction result
interface ContentExtractionResult {
  content?: string
  title?: string
  description?: string
  author?: string
  published_at?: string
  image_url?: string
}

console.log(`Readspace background script loaded on ${getBrowserName()}`)

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
  // Create context menu items
  browser.contextMenus.create({
    id: 'save-to-readspace',
    title: 'Save to Readspace',
    contexts: ['page', 'link'],
    documentUrlPatterns: ['http://*/*', 'https://*/*']
  })

  browser.contextMenus.create({
    id: 'save-link-to-readspace',
    title: 'Save link to Readspace',
    contexts: ['link'],
    documentUrlPatterns: ['http://*/*', 'https://*/*']
  })

  browser.contextMenus.create({
    id: 'discover-feeds',
    title: 'Discover RSS feeds',
    contexts: ['page'],
    documentUrlPatterns: ['http://*/*', 'https://*/*']
  })
})

// Handle context menu clicks
browser.contextMenus.onClicked.addListener((info: Menus.OnClickData, tab?: browser.Tabs.Tab) => {
  if (!tab?.id || !tab.url || !isSupportedUrl(tab.url)) {
    console.log('Context menu clicked on unsupported page:', tab?.url)
    browser.notifications.create('unsupported-page', {
      type: 'basic',
      iconUrl: 'icons/icon-48.png',
      title: 'Readspace',
      message: 'This page type is not supported. Readspace only works on websites (http:// and https:// pages).'
    })
    return
  }

  switch (info.menuItemId) {
    case 'save-to-readspace':
      handleSaveToReadspace(tab.url || info.pageUrl || '', tab)
      break
    case 'save-link-to-readspace':
      if (info.linkUrl && isSupportedUrl(info.linkUrl)) {
        handleSaveToReadspace(info.linkUrl, tab)
      } else {
        browser.notifications.create('unsupported-link', {
          type: 'basic',
          iconUrl: 'icons/icon-48.png',
          title: 'Readspace',
          message: 'This link type is not supported.'
        })
      }
      break
    case 'discover-feeds':
      handleDiscoverFeeds(tab)
      break
  }
})

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
    
    // Get extension settings using our storage helper
    const settings = await storage.get('readspace-extension')
    const settingsData = (settings as any)?.state?.settings
    
    console.log('Extension settings loaded:', {
      hasAccessToken: !!settingsData?.access_token,
      readspaceUrl: settingsData?.readspace_url,
      settings: settingsData
    })

    if (!settingsData?.access_token) {
      console.log('No access token found, showing authentication notification')
      // Show notification that user needs to authenticate
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
    
    const requestBody = {
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
    }
    
    console.log('Saving to Readspace API with request:', requestBody)
    
    // Save to Readspace API
    const response = await fetch(`${settingsData.readspace_url}/api/v1/articles/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settingsData.access_token}`
      },
      body: JSON.stringify(requestBody)
    })

    console.log('API response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    })

    if (response.ok) {
      const responseData = await response.json()
      console.log('Article saved successfully:', responseData)
      browser.notifications.create('save-success', {
        type: 'basic',
        iconUrl: 'icons/icon-48.png',
        title: 'Readspace',
        message: 'Article saved successfully!'
      })
    } else {
      const errorText = await response.text()
      console.error('API error response:', errorText)
      throw new Error(`Failed to save article: ${response.statusText} - ${errorText}`)
    }
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
    const settings = await storage.get('readspace-extension')
    const settingsData = (settings as any)?.state?.settings
    const url = settingsData?.readspace_url || 'https://api.readspace.ai'
    
    browser.tabs.create({ url })
  } catch (error) {
    browser.tabs.create({ url: 'https://api.readspace.ai' })
  }
} 