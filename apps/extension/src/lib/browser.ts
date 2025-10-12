import browser from 'webextension-polyfill'

// Re-export the polyfilled browser API
// This ensures we use the same API surface across Chrome and Firefox
export { browser }

// Type-safe wrapper for browser APIs
export const getBrowser = () => {
  return browser
}

// Browser detection utilities
export const isChrome = () => {
  const globalChrome = (globalThis as { chrome?: typeof chrome }).chrome
  return (
    typeof globalChrome !== 'undefined' && globalChrome?.runtime !== undefined
  )
}

export const isFirefox = () => {
  const globalBrowser = (globalThis as { browser?: typeof browser }).browser
  return (
    typeof globalBrowser !== 'undefined' && globalBrowser?.runtime !== undefined
  )
}

export const getBrowserName = (): 'chrome' | 'firefox' | 'unknown' => {
  if (isChrome()) return 'chrome'
  if (isFirefox()) return 'firefox'
  return 'unknown'
}

// Storage helpers that work across browsers
export const storage = {
  async get<T>(key: string): Promise<T | undefined> {
    const result = await browser.storage.local.get(key)
    return result[key] as T | undefined
  },

  async set<T>(key: string, value: T): Promise<void> {
    await browser.storage.local.set({ [key]: value })
  },

  async remove(key: string): Promise<void> {
    await browser.storage.local.remove(key)
  },

  async clear(): Promise<void> {
    await browser.storage.local.clear()
  },
}

// Messaging helpers
export const messaging = {
  async sendToTab<T>(
    tabId: number,
    message: Record<string, unknown>
  ): Promise<T> {
    return browser.tabs.sendMessage(tabId, message) as Promise<T>
  },

  async sendToBackground<T>(message: Record<string, unknown>): Promise<T> {
    return browser.runtime.sendMessage(message) as Promise<T>
  },

  onMessage: browser.runtime.onMessage,
}

// Tab helpers
export const tabs = {
  async query(queryInfo: browser.Tabs.QueryQueryInfoType) {
    return browser.tabs.query(queryInfo)
  },

  async create(createProperties: browser.Tabs.CreateCreatePropertiesType) {
    return browser.tabs.create(createProperties)
  },

  async sendMessage<T>(
    tabId: number,
    message: Record<string, unknown>
  ): Promise<T> {
    return browser.tabs.sendMessage(tabId, message) as Promise<T>
  },
}

// Notifications helpers
export const notifications = {
  async create(
    notificationId: string,
    options: browser.Notifications.CreateNotificationOptions
  ) {
    return browser.notifications.create(notificationId, options)
  },
}

// Identity API - now natively supported in both Chrome and Firefox
export const identity = browser.identity

export default browser
