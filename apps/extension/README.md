# Readspace Browser Extension

A powerful browser extension to save articles to Readspace for later reading. Works on both Chrome and Firefox.

## Cross-Browser Support

This extension supports both Chrome and Firefox using the WebExtensions API with automatic browser detection and compatibility handling.

### Browser Compatibility

- **Chrome**: Manifest V3, full feature support with service workers
- **Firefox**: Manifest V3, full feature support with background scripts (Firefox service worker support is limited)
- **Edge**: Compatible (same as Chrome)
- **Other Chromium browsers**: Compatible

## Quick Start

### Prerequisites

- Node.js 18+ and Bun
- Chrome and/or Firefox for testing

### Installation

```bash
# Install dependencies
bun install

# Build for Chrome (default)
bun run build

# Build for Firefox
bun run build:firefox

# Build for both browsers
bun run build:all
```

## Build Commands

### Development

```bash
# Chrome development (with hot reload)
bun run dev

# Firefox development (with auto-reload and temporary profile)
bun run dev:firefox:watch
```

The `dev:firefox:watch` command will:
- Build the extension for Firefox
- Launch Firefox with the extension loaded
- Watch for changes and automatically rebuild
- Reload the extension in Firefox on changes

### Building

```bash
# Build Chrome extension
bun run build:chrome

# Build Firefox extension  
bun run build:firefox

# Build both browsers
bun run build:all
```

### Packaging

```bash
# Package Chrome extension (creates .zip ready for Chrome Web Store)
bun run package:chrome

# Package Firefox extension (creates .xpi using web-ext)
bun run package:firefox

# Package for both browsers
bun run package:all
```

## Development

### Project Structure

```
extension/
├── src/
│   ├── manifest.chrome.json     # Chrome-specific manifest
│   ├── manifest.firefox.json    # Firefox-specific manifest
│   ├── lib/
│   │   └── browser.ts           # Cross-browser compatibility layer
│   ├── background.ts            # Background script (service worker)
│   ├── content.ts               # Content script
│   ├── popup.tsx                # Extension popup
│   └── components/              # React components
├── dist/                        # Chrome build output
├── dist-firefox/                # Firefox build output
├── web-ext-artifacts/           # Firefox packages (.xpi files)
└── web-ext-config.cjs           # Firefox development configuration
```

### Browser Compatibility Layer

The extension uses a compatibility layer (`src/lib/browser.ts`) that:

- Uses `webextension-polyfill` for consistent Promise-based APIs
- Provides browser detection utilities
- Abstracts common extension APIs (storage, messaging, tabs, notifications)
- Ensures the same code works on both Chrome and Firefox

Example usage:

```typescript
import { browser, getBrowserName, storage, tabs } from '@/lib/browser'

// Browser detection
console.log(`Running on ${getBrowserName()}`) // 'chrome' | 'firefox'

// Storage (works the same on both browsers)
await storage.set('key', 'value')
const value = await storage.get('key')

// Tabs (Promise-based API)
const tabs = await tabs.query({ active: true })
```

### Manifest Differences

The extension uses separate manifest files for each browser:

**Chrome (`src/manifest.chrome.json`)**:
- Standard Manifest V3
- Uses `service_worker` with `type: "module"`

**Firefox (`src/manifest.firefox.json`)**:
- Manifest V3 with Firefox optimizations
- Uses `background.scripts` instead of `service_worker` (Firefox service worker support is limited)
- Includes `browser_specific_settings` for addon ID
- Minimum Firefox version requirement (109.0+)

### TypeScript Support

The project includes proper TypeScript support for both browsers:

- `@types/chrome` for Chrome APIs
- `@types/webextension-polyfill` for cross-browser types
- Custom type declarations in `vite-env.d.ts`

## 🧪 Testing

### Chrome

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist/` folder

### Firefox

1. **Development**: Use `bun run dev:firefox:watch` (recommended)
   - Automatically builds and launches Firefox with the extension
   - Creates a temporary profile
   - Watches for changes and auto-reloads
2. **Manual loading**:
   - Open `about:debugging`
   - Click "This Firefox"
   - Click "Load Temporary Add-on"
   - Select any file in `dist-firefox/`

### Firefox with web-ext

```bash
# Run in temporary Firefox profile with auto-reload
bun run dev:firefox:watch

# Lint Firefox extension
bun run lint:firefox

# Package for Firefox
bun run package:firefox
```

## Configuration

### web-ext Configuration

Firefox development is configured via `web-ext-config.cjs`:

```javascript
module.exports = {
  sourceDir: './dist-firefox',
  artifactsDir: './web-ext-artifacts',
  run: {
    firefox: 'firefox',
    startUrl: ['about:debugging#/runtime/this-firefox'],
  },
}
```

### Vite Configuration

The build system automatically:

- Selects the correct manifest file based on build mode
- Sets the appropriate output directory (`dist/` vs `dist-firefox/`)
- Defines `__BROWSER__` constant for runtime detection

##  Troubleshooting

### Common Issues

**webextension-polyfill not found**: 
```bash
bun install
```

**Build fails with manifest errors**:
- Check that `src/manifest.chrome.json` and `src/manifest.firefox.json` exist
- Verify JSON syntax

**Firefox extension won't load**:
- Use `bun run lint:firefox` to check for issues
- Check browser console for errors
- Ensure minimum Firefox version (109+)
- If you see "service_worker is disabled" error, this is expected - Firefox uses `background.scripts`

**Firefox watch mode not working**:
- Ensure Firefox is installed and in your PATH
- Try running `bun run dev:firefox` for a one-time launch without watch mode

**Chrome extension manifest errors**:
- Verify Manifest V3 compatibility
- Check Chrome developer console

**web-ext config errors**:
- Ensure `web-ext-config.cjs` is used (not `.js`) due to ES modules in package.json

### Development Tips

1. **Use the browser compatibility layer** instead of direct `chrome.*` calls
2. **Test on both browsers** during development
3. **Use proper TypeScript types** from webextension-polyfill
4. **Check browser-specific features** and provide fallbacks if needed
5. **Firefox development**: Use `bun run dev:firefox:watch` for the best experience with auto-reload

## Contributing

When contributing:

1. Test changes on both Chrome and Firefox
2. Use the browser compatibility layer for new API calls
3. Update both manifest files if adding new permissions
4. Run `bun run lint:firefox` before submitting
5. Use `bun` for dependency management 