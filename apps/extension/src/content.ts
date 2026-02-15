// Content script for Readspace extension
import browser from 'webextension-polyfill'
import { extractArticleContent } from './lib/content-extractor'
import { scanForFeeds } from './lib/feed-discovery'
import { ExtensionMessage } from './shared/types'

// Message listener for popup and background script requests
browser.runtime.onMessage.addListener((request: unknown) => {
  const message = request as ExtensionMessage
  const action = message.type

  switch (action) {
    case 'extractMetadata':
      // Fast extraction - discover feeds in background
      return extractPageMetadataFast().catch((error) => ({
        error: error.message,
      }))
    case 'extractContent':
      return extractArticleContent().catch((error) => ({
        error: error.message,
      }))
    case 'discoverFeeds':
      return Promise.resolve(scanForFeeds()).catch((error) => ({
        error: error.message,
      }))
  }
})

/**
 * Extract basic metadata from the current page (FAST - no feed validation)
 */
async function extractPageMetadataFast() {
  // Discover potential feeds quickly without validation
  const feeds = scanForFeeds()

  // Use extractArticleContent but we only really need the metadata part
  const content = await extractArticleContent()

  return {
    ...content,
    feeds,
  }
}
