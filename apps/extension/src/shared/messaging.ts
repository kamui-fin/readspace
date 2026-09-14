import browser from 'webextension-polyfill'
import { ApiError } from '@readspace/shared'
import { ExtensionMessage } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sendMessage<T = any>(msg: ExtensionMessage): Promise<T> {
  const response = (await browser.runtime.sendMessage(msg)) as {
    data: T
    error?: string
    status?: number
  }
  if (!response) {
    throw new Error('No response')
  }
  if (response.error) {
    // Rehydrate API failures so callers can branch on the HTTP status
    throw typeof response.status === 'number'
      ? new ApiError(response.status, response.error)
      : new Error(response.error)
  }
  return response.data
}

// Chrome and Firefox both word a tab without a live content script this way
const MISSING_RECEIVER_PATTERN =
  /receiving end does not exist|could not establish connection/i
const CONTENT_SCRIPT_READY_ATTEMPTS = 5
const CONTENT_SCRIPT_READY_DELAY_MS = 150

function isMissingReceiverError(error: unknown): boolean {
  return error instanceof Error && MISSING_RECEIVER_PATTERN.test(error.message)
}

/**
 * Inject the manifest's content scripts into a tab. Needed for tabs that were open
 * before the extension was installed, updated, or reloaded: their old content
 * script is orphaned and no longer receives messages.
 */
async function injectContentScripts(tabId: number): Promise<void> {
  const files =
    browser.runtime
      .getManifest()
      .content_scripts?.flatMap((script) => script.js ?? []) ?? []
  if (files.length === 0) return
  await browser.scripting.executeScript({ target: { tabId }, files })
}

/**
 * Message a tab's content script, injecting it first if the tab has none.
 * Retries briefly after injection while the loader's dynamic import registers
 * the message listener.
 */
export async function sendTabMessage<T>(
  tabId: number,
  type: string,
  timeout = 5000
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await sendTabMessageOnce<T>(tabId, type, timeout)
    } catch (error) {
      if (
        !isMissingReceiverError(error) ||
        attempt >= CONTENT_SCRIPT_READY_ATTEMPTS
      ) {
        throw error
      }
      if (attempt === 0) {
        console.info('Injecting content script into tab', tabId)
        await injectContentScripts(tabId)
      }
      await new Promise((resolve) =>
        setTimeout(resolve, CONTENT_SCRIPT_READY_DELAY_MS)
      )
    }
  }
}

function sendTabMessageOnce<T>(
  tabId: number,
  type: string,
  timeout: number
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout: ${type} took longer than ${timeout}ms`))
    }, timeout)

    browser.tabs
      .sendMessage(tabId, { type })
      .then((response) => {
        clearTimeout(timer)
        resolve(response as T)
      })
      .catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
  })
}
