// Background script for Readspace extension
console.log('Readspace background script loaded')

// Context menu setup
chrome.runtime.onInstalled.addListener(() => {
  // Create context menu items
  chrome.contextMenus.create({
    id: 'save-to-readspace',
    title: 'Save to Readspace',
    contexts: ['page', 'link'],
  })

  chrome.contextMenus.create({
    id: 'save-link-to-readspace',
    title: 'Save link to Readspace',
    contexts: ['link'],
  })

  chrome.contextMenus.create({
    id: 'discover-feeds',
    title: 'Discover RSS feeds',
    contexts: ['page'],
  })
})

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return

  switch (info.menuItemId) {
    case 'save-to-readspace':
      handleSaveToReadspace(tab.url || info.pageUrl || '', tab)
      break
    case 'save-link-to-readspace':
      if (info.linkUrl) {
        handleSaveToReadspace(info.linkUrl, tab)
      }
      break
    case 'discover-feeds':
      handleDiscoverFeeds(tab)
      break
  }
})

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0]
    if (!tab?.id) return

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
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'saveArticle':
      handleSaveToReadspace(request.url, sender.tab)
      break
    case 'extractContent':
      handleExtractContent(sender.tab?.id, request.url)
        .then(sendResponse)
        .catch(error => sendResponse({ error: error.message }))
      return true // Keep message channel open for async response
    case 'discoverFeeds':
      handleDiscoverFeeds(sender.tab)
      break
  }
})

async function handleSaveToReadspace(url: string, tab?: chrome.tabs.Tab) {
  try {
    console.log('handleSaveToReadspace called with:', { url, tabId: tab?.id, tabTitle: tab?.title })
    
    // Get extension settings
    const result = await chrome.storage.local.get(['readspace-extension'])
    const settings = result['readspace-extension']?.state?.settings
    
    console.log('Extension settings loaded:', {
      hasAccessToken: !!settings?.access_token,
      readspaceUrl: settings?.readspace_url,
      settings: settings
    })

    if (!settings?.access_token) {
      console.log('No access token found, showing authentication notification')
      // Show notification that user needs to authenticate
      chrome.notifications.create({
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
    const response = await fetch(`${settings.readspace_url}/api/v1/articles/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.access_token}`
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
      chrome.notifications.create({
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
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-48.png',
      title: 'Readspace',
      message: `Failed to save article: ${error instanceof Error ? error.message : 'Unknown error'}`
    })
  }
}

async function handleExtractContent(tabId?: number, url?: string) {
  if (!tabId) {
    console.log('handleExtractContent: no tabId provided')
    return null
  }

  try {
    console.log('handleExtractContent: sending message to content script', { tabId, url })
    // Send message to content script to extract content
    const content = await chrome.tabs.sendMessage(tabId, { 
      action: 'extractContent',
      url 
    })
    console.log('handleExtractContent: received response from content script:', content)
    return content
  } catch (error) {
    console.error('Failed to extract content:', error)
    return null
  }
}

async function handleDiscoverFeeds(tab?: chrome.tabs.Tab) {
  if (!tab?.id) return

  try {
    const feeds = await chrome.tabs.sendMessage(tab.id, { 
      action: 'discoverFeeds' 
    })
    
    if (feeds?.length > 0) {
      // TODO: Show feed subscription interface
      console.log('Discovered feeds:', feeds)
    } else {
      chrome.notifications.create({
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
    const result = await chrome.storage.local.get(['readspace-extension'])
    const settings = result['readspace-extension']?.state?.settings
    const url = settings?.readspace_url || 'https://readspace.app'
    
    chrome.tabs.create({ url })
  } catch (error) {
    chrome.tabs.create({ url: 'https://readspace.app' })
  }
} 