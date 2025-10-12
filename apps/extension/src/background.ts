// Background script for Readspace extension
import { ApiClient } from '@/lib/api-client'
import { browser, getBrowserName, identity, storage } from '@/lib/browser'
import type { CachedPageContent, CachedPageMetadata } from '@/lib/page-cache'
import { pageCache } from '@/lib/page-cache'
import { getSupabaseClient } from '@/lib/supabase'
import { trimSaveArticleRequest } from '@readspace/shared'
import type { Runtime } from 'webextension-polyfill'
import { extractOAuthTokens } from './lib/oauth'

// Type for content extraction result
interface ContentExtractionResult {
  content?: string
  title?: string
  description?: string
  author?: string
  published_at?: string
  image_url?: string
  estimated_read_time?: number
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

// Validate if a URL is a valid RSS/Atom feed using HEAD request
async function validateFeedUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(3000),
    })

    if (!response.ok) {
      return false
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() || ''

    // Check if content type indicates a feed
    return (
      contentType.includes('xml') ||
      contentType.includes('rss') ||
      contentType.includes('atom') ||
      contentType.includes('json') ||
      contentType.includes('application/rss') ||
      contentType.includes('application/atom')
    )
  } catch {
    return false
  }
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
      state?: {
        settings?: { supabase_url?: string; supabase_anon_key?: string }
      }
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

// Legacy in-memory cache for tab metadata and content (keyed by tabId)
// This is kept for backward compatibility with the existing getCachedMetadata/getCachedContent messages
const metadataCache = new Map<number, PageMetadataResponse>()
const contentCache = new Map<number, ContentExtractionResult>()

/**
 * Validate suggested feeds in background and update caches with only valid feeds
 */
async function validateAndUpdateFeeds(
  tabId: number,
  url: string,
  feeds: Array<{ url: string; title?: string; type: string }>
): Promise<void> {
  console.log(`Validating ${feeds.length} feeds in background for ${url}`)

  // Validate feeds in parallel (with concurrency limit of 3 to avoid overwhelming the browser)
  const validFeeds: Array<{ url: string; title?: string; type: string }> = []

  for (let i = 0; i < feeds.length; i += 3) {
    const batch = feeds.slice(i, i + 3)
    const results = await Promise.all(
      batch.map(async (feed) => {
        const isValid = await validateFeedUrl(feed.url)
        return { feed, isValid }
      })
    )

    results.forEach(({ feed, isValid }) => {
      if (isValid) {
        validFeeds.push(feed)
        console.log(`✓ Feed validated: ${feed.url}`)
      } else {
        console.log(`✗ Feed invalid: ${feed.url}`)
      }
    })
  }

  // Update caches with validated feeds only if we found valid feeds
  if (validFeeds.length > 0 && validFeeds.length !== feeds.length) {
    console.log(
      `Updating caches with ${validFeeds.length} validated feeds (filtered from ${feeds.length})`
    )

    // Update legacy cache
    const legacyCached = metadataCache.get(tabId)
    if (legacyCached) {
      legacyCached.feeds = validFeeds
      metadataCache.set(tabId, legacyCached)
    }

    // Update persistent cache
    const persistentCached = await pageCache.getMetadata(url)
    if (persistentCached) {
      persistentCached.feeds = validFeeds
      await pageCache.setMetadata(url, persistentCached)
    }

    // Update badge with validated count
    await updateFeedBadge(tabId, validFeeds.length)
  } else if (validFeeds.length === 0) {
    console.log('No valid feeds found after validation')
    // Clear feed list if nothing is valid
    const legacyCached = metadataCache.get(tabId)
    if (legacyCached) {
      legacyCached.feeds = []
      metadataCache.set(tabId, legacyCached)
    }

    const persistentCached = await pageCache.getMetadata(url)
    if (persistentCached) {
      persistentCached.feeds = []
      await pageCache.setMetadata(url, persistentCached)
    }

    await updateFeedBadge(tabId, 0)
  } else {
    console.log('All feeds are valid, no cache update needed')
  }
}

// Check for RSS feeds when tab is updated and cache metadata
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Check for OAuth callback first
  if (changeInfo.url?.startsWith(identity.getRedirectURL())) {
    await handleOAuthCallback(changeInfo.url, tabId)
    return
  }

  // Clear legacy caches when URL changes
  if (changeInfo.url) {
    metadataCache.delete(tabId)
    contentCache.delete(tabId)
  }

  if (changeInfo.status === 'complete' && tab.url && isSupportedUrl(tab.url)) {
    try {
      // Start metadata extraction immediately without delay for faster preloading
      setTimeout(async () => {
        try {
          // Get full metadata which includes feeds
          const metadata = (await browser.tabs.sendMessage(tabId, {
            action: 'extractMetadata',
          })) as PageMetadataResponse

          // Cache the metadata in both legacy cache and new persistent cache
          metadataCache.set(tabId, metadata)
          await pageCache.setMetadata(tab.url!, metadata as CachedPageMetadata)

          const feedCount = metadata?.feeds?.length || 0
          console.log(
            `Found ${feedCount} feeds on tab ${tabId}, metadata cached for ${tab.url}`,
            metadata?.feeds
          )

          await updateFeedBadge(tabId, feedCount)

          // Validate suggested feeds in background and update cache with only valid feeds
          if (metadata?.feeds && metadata.feeds.length > 0) {
            validateAndUpdateFeeds(tabId, tab.url!, metadata.feeds).catch((error) => {
              console.log('Failed to validate feeds in background:', error)
            })
          }

          // Also extract and cache content for reading time (in background)
          try {
            const content = (await browser.tabs.sendMessage(tabId, {
              action: 'extractContent',
            })) as ContentExtractionResult

            if (content) {
              contentCache.set(tabId, content)
              await pageCache.setContent(tab.url!, content as CachedPageContent)
              console.log(
                `Content cached for tab ${tabId} (${tab.url}), reading time: ${content.estimated_read_time || 0} min`
              )
            }
          } catch (contentError) {
            console.log('Could not extract content for caching:', contentError)
            // Non-critical, just continue
          }
        } catch (error) {
          // Content script might not be available yet, ignore error
          console.log(
            'Could not check for feeds, content script not available:',
            error
          )
          await updateFeedBadge(tabId, 0)
        }
      }, 500) // Reduced timeout for faster metadata extraction
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
browser.runtime.onInstalled.addListener(async () => {
  // Create context menu for saving to Readspace
  try {
    await browser.contextMenus.create({
      id: 'save-to-readspace',
      title: 'Save to Readspace',
      contexts: ['page', 'link', 'selection'],
    })
    console.log('Context menu created successfully')
  } catch (error) {
    console.error('Failed to create context menu:', error)
  }
})

// Handle context menu clicks
browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'save-to-readspace' && tab?.url) {
    // Determine the URL to save
    const urlToSave = info.linkUrl || info.frameUrl || tab.url

    if (urlToSave && isSupportedUrl(urlToSave)) {
      await handleSaveToReadspace(urlToSave, tab)
    } else {
      browser.notifications.create('unsupported-url', {
        type: 'basic',
        iconUrl: 'icons/icon-48.png',
        title: 'Readspace',
        message: 'This page type is not supported. Readspace only works on websites (http:// and https:// pages).',
      })
    }
  }
})

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

    // Handle getCachedMetadata - return cached data instantly if available (legacy tabId-based)
    if (messageRequest.action === 'getCachedMetadata') {
      const tabId = messageRequest.tabId as number
      const cached = metadataCache.get(tabId)
      sendResponse(cached || null)
      return true // Keep channel open even for synchronous response
    }

    // Handle getCachedContent - return cached content data instantly if available (legacy tabId-based)
    if (messageRequest.action === 'getCachedContent') {
      const tabId = messageRequest.tabId as number
      const cached = contentCache.get(tabId)
      sendResponse(cached || null)
      return true // Keep channel open even for synchronous response
    }

    // Handle getCachedMetadataByUrl - return cached metadata by URL
    if (messageRequest.action === 'getCachedMetadataByUrl') {
      const url = messageRequest.url as string
      pageCache.getMetadata(url)
        .then(sendResponse)
        .catch(() => sendResponse(null))
      return true // Keep channel open for async response
    }

    // Handle getCachedContentByUrl - return cached content by URL
    if (messageRequest.action === 'getCachedContentByUrl') {
      const url = messageRequest.url as string
      pageCache.getContent(url)
        .then(sendResponse)
        .catch(() => sendResponse(null))
      return true // Keep channel open for async response
    }

    // Handle getCachedPageByUrl - return full cached page data by URL
    if (messageRequest.action === 'getCachedPageByUrl') {
      const url = messageRequest.url as string
      pageCache.get(url)
        .then(sendResponse)
        .catch(() => sendResponse(null))
      return true // Keep channel open for async response
    }

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

async function handleEmailPasswordLogin(email: string, password: string): Promise<{ success: boolean; error?: string; access_token?: string }> {
  console.log('🔐 Background script: Starting email/password login...')

  try {
    // Get settings from storage
    const store = await storage.get<{
      settings?: {
        supabase_url?: string
        supabase_anon_key?: string
      }
    }>('readspace-extension')

    // Use stored settings or fall back to defaults
    const supabaseUrl = store?.settings?.supabase_url || 'https://hnqyngkyugiamvlhqoaf.supabase.co'
    const supabaseAnonKey = store?.settings?.supabase_anon_key ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhucXluZ2t5dWdpYW12bGhxb2FmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAzODIwNDMsImV4cCI6MjA2NTk1ODA0M30.iu6pCWAX5ofuSumz6V0VwKNSEh88XDJ2RCC_iTln0xs'

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        'Supabase configuration is missing. Please check settings.'
      )
    }

    // Initialize Supabase client
    const supabase = getSupabaseClient(
      supabaseUrl,
      supabaseAnonKey
    )

    if (!supabase) {
      throw new Error('Failed to initialize Supabase client')
    }

    console.log('🔑 Signing in with email/password...')

    // Sign in with email/password
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    })

    if (error) throw error

    if (!data.session?.access_token) {
      throw new Error('No access token received')
    }

    console.log('✅ Email/password sign-in successful, storing session...')

    // Update the settings in storage with the access token
    const updatedSettings = {
      ...(store?.settings || {}),
      supabase_url: supabaseUrl,
      supabase_anon_key: supabaseAnonKey,
      access_token: data.session.access_token,
    }

    await storage.set('readspace-extension', {
      ...store,
      settings: updatedSettings,
      isAuthenticated: true,
    })

    console.log('✅ Login completed successfully!')

    return {
      success: true,
      access_token: data.session.access_token,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Failed to sign in'
    console.error('❌ Email/password login error:', error)
    return {
      success: false,
      error: errorMessage,
    }
  }
}

async function handleGoogleOAuth(): Promise<{ success: boolean; error?: string; access_token?: string }> {
  console.log('🔐 Background script: Starting Google OAuth flow...')

  try {
    // Get settings from storage
    const store = await storage.get<{
      settings?: {
        supabase_url?: string
        supabase_anon_key?: string
        google_client_id?: string
      }
    }>('readspace-extension')

    // Use stored settings or fall back to defaults
    const supabaseUrl = store?.settings?.supabase_url || 'https://hnqyngkyugiamvlhqoaf.supabase.co'
    const supabaseAnonKey = store?.settings?.supabase_anon_key ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhucXluZ2t5dWdpYW12bGhxb2FmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAzODIwNDMsImV4cCI6MjA2NTk1ODA0M30.iu6pCWAX5ofuSumz6V0VwKNSEh88XDJ2RCC_iTln0xs'
    const googleClientId = store?.settings?.google_client_id || '618963664803-spg7g7mmlqj1lm47nph2ct16m7318u1e.apps.googleusercontent.com'

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        'Supabase configuration is missing. Please check settings.'
      )
    }

    // Get manifest to check for oauth2 configuration (Chrome only)
    const manifest = browser.runtime.getManifest() as chrome.runtime.Manifest & {
      oauth2?: { client_id: string; scopes: string[] }
    }

    // Determine client ID - Chrome uses manifest, Firefox uses settings/defaults
    const clientId = manifest.oauth2?.client_id || googleClientId

    if (!clientId) {
      throw new Error(
        'Google OAuth client ID not configured. ' +
        (manifest.oauth2 ?
          'Please set it in the manifest.' :
          'Please add it in Settings.')
      )
    }

    // Get the redirect URL - works for both Chrome and Firefox
    const redirectUri = browser.identity.getRedirectURL()
    console.log('🔗 OAuth Redirect URI:', redirectUri)
    const scopes = manifest.oauth2?.scopes || ['openid', 'email', 'profile']

    // Construct Google OAuth URL
    const url = new URL('https://accounts.google.com/o/oauth2/auth')
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('response_type', 'id_token')
    url.searchParams.set('access_type', 'offline')
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('scope', scopes.join(' '))

    console.log('🚀 Launching OAuth flow...')

    // Launch browser's native auth flow (works in both Chrome and Firefox)
    const redirectedTo = await browser.identity.launchWebAuthFlow({
      url: url.href,
      interactive: true,
    })

    if (!redirectedTo) {
      throw new Error('Authentication was cancelled or failed')
    }

    console.log('✅ OAuth flow completed, extracting token...')

    // Extract ID token from redirect URL
    const redirectUrl = new URL(redirectedTo)
    const params = new URLSearchParams(redirectUrl.hash.substring(1))
    const idToken = params.get('id_token')

    if (!idToken) {
      throw new Error('No ID token received from Google')
    }

    console.log('🔑 ID token received, signing in to Supabase...')

    // Initialize Supabase client
    const supabase = getSupabaseClient(
      supabaseUrl,
      supabaseAnonKey
    )

    if (!supabase) {
      throw new Error('Failed to initialize Supabase client')
    }

    // Sign in with ID token
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    })

    if (error) throw error

    if (!data.session?.access_token) {
      throw new Error('No access token received from Supabase')
    }

    console.log('✅ Supabase sign-in successful, storing session...')

    // Update the settings in storage with the access token
    const updatedSettings = {
      ...(store?.settings || {}),
      supabase_url: supabaseUrl,
      supabase_anon_key: supabaseAnonKey,
      google_client_id: googleClientId,
      access_token: data.session.access_token,
    }

    await storage.set('readspace-extension', {
      ...store,
      settings: updatedSettings,
      isAuthenticated: true,
    })

    console.log('✅ OAuth flow completed successfully!')

    return {
      success: true,
      access_token: data.session.access_token,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Failed to complete Google sign-in'
    console.error('❌ Google OAuth error:', error)
    return {
      success: false,
      error: errorMessage,
    }
  }
}
