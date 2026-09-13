import browser from 'webextension-polyfill'
import { ExtensionMessage } from '../shared/types'

/** Notify open extension pages (popup) of a background state change. */
export function broadcast(message: ExtensionMessage) {
  browser.runtime.sendMessage(message).catch(() => {
    // No popup open to receive it
  })
}
