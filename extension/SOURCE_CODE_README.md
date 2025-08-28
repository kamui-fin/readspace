# Firefox Source Code Build Instructions

This document provides instructions for Mozilla reviewers to build the Readspace browser extension from source code.

## Build Environment Requirements

- **Operating System**: Ubuntu 24.04 LTS or compatible Linux distribution
- **CPU Architecture**: ARM64 (default reviewer environment compatible)
- **Memory**: 4GB RAM minimum
- **Disk Space**: 2GB free space minimum
- **Node.js**: Version 22 LTS
- **Package Manager**: npm 10 (included with Node 22)

## Required Tools

All build tools are open source and can be installed via npm:

- **TypeScript**: ^5.6.3 (installed via devDependencies)
- **Vite**: ^5.4.10 (installed via devDependencies) 
- **@crxjs/vite-plugin**: ^2.0.0-beta.25 (installed via devDependencies)

## Build Instructions

1. **Extract the source code archive** to a directory
2. **Navigate to the extension directory**:
   ```bash
   cd readspace-extension-source
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Build the Firefox extension**:
   ```bash
   npm run build:firefox
   ```

This will create the built extension in the `dist-firefox/` directory.

## Build Process Details

The build process performs the following transformations:

1. **TypeScript Compilation**: All `.ts` and `.tsx` files are compiled to JavaScript
2. **Module Bundling**: Vite bundles all modules and dependencies into optimized chunks
3. **Manifest Processing**: The Firefox-specific manifest (`src/manifest.firefox.json`) is processed and moved to the root
4. **Asset Processing**: Static assets like icons and SVG files are copied to the output directory
5. **React/JSX Compilation**: React components are compiled to JavaScript

## Verification

After building, compare the contents of `dist-firefox/` with the submitted extension package. The built files should match exactly.

## Key Build Scripts

- `npm run build:firefox` - Builds the Firefox version
- `npm run type-check` - Runs TypeScript type checking
- `npm run lint` - Runs ESLint checks

## Dependencies

All dependencies are specified in `package.json` and locked in `pnpm-lock.yaml`. No additional downloads or external tools are required beyond what's installed via `npm install`.

## Build Output Structure

```
dist-firefox/
├── assets/           # Bundled JavaScript and CSS files
├── icons/            # Extension icons
├── src/
│   └── assets/       # Web accessible resources
├── index.html        # Popup HTML
└── manifest.json     # Generated manifest
```

## Troubleshooting

- If build fails with memory errors, increase Node.js heap size: `NODE_OPTIONS="--max-old-space-size=4096" npm run build:firefox`
- Ensure all files are extracted with proper permissions
- Node.js 22 LTS is required for compatibility with the build tools

## Contact

If you encounter any issues with the build process, the complete source code and all necessary files are included in this submission.
