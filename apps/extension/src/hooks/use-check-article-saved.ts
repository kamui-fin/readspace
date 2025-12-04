import { useState, useEffect } from 'react'
import { sendMessage } from '../shared/messaging'
import { CheckArticleSavedResponse } from '@readspace/shared'
import { ExtensionMessage } from '../shared/types'
import browser from 'webextension-polyfill'
import { normalizeKey } from '../lib/normalize'

export function useCheckArticleSaved(url?: string) {
  const [savedArticle, setSavedArticle] =
    useState<CheckArticleSavedResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!url) {
      setSavedArticle(null)
      return
    }

    let mounted = true
    setIsLoading(true)

    // Initial check
    sendMessage<CheckArticleSavedResponse>({
      type: 'checkArticleSaved',
      payload: { url },
    })
      .then((data) => {
        if (mounted) setSavedArticle(data)
      })
      .catch((err) => {
        console.error('Failed to check if article is saved:', err)
      })
      .finally(() => {
        if (mounted) setIsLoading(false)
      })

    const listener = (msg: unknown) => {
      const message = msg as ExtensionMessage
      if (message.type === 'save-changed' || message.type === 'save-success') {
        const normUrl = normalizeKey(url)
        // message.payload.url is already normalized by background
        if (message.payload.url === normUrl) {
          setSavedArticle((prev) => {
            if (!prev) return null // Can't update if we don't have base object, or should we fetch?
            // If we are saving, we might want to show it as saved even if we don't have full details yet?
            // But usually we have details if we are on the page.

            // We need to cast or ensure we return valid CheckArticleSavedResponse
            // Assuming CheckArticleSavedResponse has 'saved' boolean.
            return { ...prev, saved: message.payload.saved }
          })
        }
      }
    }

    browser.runtime.onMessage.addListener(listener)

    return () => {
      mounted = false
      browser.runtime.onMessage.removeListener(listener)
    }
  }, [url])

  return { savedArticle, setSavedArticle, isLoading }
}
