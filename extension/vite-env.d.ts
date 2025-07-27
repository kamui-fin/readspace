/// <reference types="vite/client" />

// Build-time constants
declare const __BROWSER__: 'chrome' | 'firefox'

// Global browser extension types
declare namespace chrome {
  // Extend chrome types if needed
}

declare namespace browser {
  // Browser API types (handled by webextension-polyfill)
} 