import { useState, useEffect } from 'react'
import { sendMessage } from '../shared/messaging'
import { CheckArticleSavedResponse } from '@readspace/shared'
import { ExtensionMessage, SaveChangedPayload } from '../shared/types'
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

    // Initial check (may be served from cache, then corrected via 'save-changed')
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
      const message = msg as ExtensionMessage<SaveChangedPayload>
      if (message.type !== 'save-changed' || !message.payload) return
      // payload.url is already normalized by the background
      if (message.payload.url === normalizeKey(url)) {
        setSavedArticle(message.payload.article)
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
