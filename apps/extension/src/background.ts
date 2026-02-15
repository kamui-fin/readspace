import browser from 'webextension-polyfill'
import './background/supabase-client' // Initializes Supabase client
import { handleMessage } from './background/message-router'
import { initTabs } from './background/tabs'
import { ExtensionMessage } from './shared/types'

console.log('Readspace Background Service Worker Starting...')

// Initialize tabs listeners
initTabs()

// Message router
browser.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
  // Return true to indicate we will send a response asynchronously
  ;(async () => {
    try {
      const response = await handleMessage(msg as ExtensionMessage)
      // In webextension-polyfill, we return the promise instead of using sendResponse
      // But for compatibility with some patterns, we can still use it or return the value
      return { data: response, error: null }
    } catch (e: unknown) {
      console.error('Message handler error:', e)
      const errorMessage = e instanceof Error ? e.message : String(e)
      throw new Error(errorMessage)
    }
  })()
    .then(sendResponse)
    .catch((error) => {
      sendResponse({ data: null, error: error.message })
    })

  return true
})
