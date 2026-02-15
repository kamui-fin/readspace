import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import { resolve } from 'path'
import { readFileSync } from 'fs'

// Load browser-specific manifest
function getManifest(mode: string) {
  const isFirefox = mode === 'firefox'
  const baseManifest = JSON.parse(
    readFileSync(resolve('./src/manifest.base.json'), 'utf-8')
  )
  const specificManifestPath = isFirefox
    ? resolve('./src/manifest.firefox.json')
    : resolve('./src/manifest.chrome.json')

  const specificManifest = JSON.parse(
    readFileSync(specificManifestPath, 'utf-8')
  )

  return {
    ...baseManifest,
    ...specificManifest,
  }
}

import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const isFirefox = mode === 'firefox'
  const manifest = getManifest(mode)

  return {
    plugins: [
      react(),
      tailwindcss(),
      crx({
        manifest,
      }),
    ],
    resolve: {
      alias: {
        '@': resolve('./src'),
      },
    },
    publicDir: 'public',
    build: {
      outDir: isFirefox ? 'dist-firefox' : 'dist',
      rollupOptions: {
        input: {
          popup: resolve('./index.html'),
        },
        external: [
          '@tailwindcss/typography',
          'tailwindcss-animate',
          'tailwindcss',
          '@tailwindcss/forms',
          'tailwindcss/plugin',
        ],
        output: {
          manualChunks: undefined, // Disable code splitting for service worker
        },
      },
    },
    define: {
      // Define browser type at build time
      __BROWSER__: JSON.stringify(isFirefox ? 'firefox' : 'chrome'),
    },
  }
})
