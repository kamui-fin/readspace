# Readspace Chrome Extension

A powerful Chrome extension that allows users to save articles to their Readspace instance for later reading. The extension seamlessly integrates with the Readspace platform and provides a clean, intuitive interface for capturing web content.

## Features

### 🚀 Core Functionality
- **One-click article saving** with intelligent metadata extraction
- **Article preview** showing title, description, images, and reading time
- **RSS feed discovery** and subscription management
- **Recent articles** quick access
- **Context menu integration** for saving links and pages
- **Keyboard shortcuts** for power users

### 🎨 User Experience
- **Modern UI** using Readspace's design system (shadcn/ui)
- **Dark/light theme** support matching system preferences
- **Responsive design** optimized for extension popup
- **Loading states** and error handling
- **Toast notifications** for feedback

### 🔧 Configuration
- **Custom Readspace instances** support
- **Authentication** via access tokens
- **Settings management** with persistent storage
- **Default folders and tags** configuration

## Installation

### From Chrome Web Store
*Coming soon - extension will be published to the Chrome Web Store*

### Development Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd readspace/extension
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the extension**:
   ```bash
   npm run build
   ```

4. **Load in Chrome**:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the `dist` folder

## Development

### Prerequisites
- Node.js 18+ and npm
- Chrome browser for testing

### Available Scripts

```bash
# Development with hot reload
npm run dev

# Build for production
npm run build

# Type checking
npm run type-check

# Linting
npm run lint

# Code formatting
npm run format
```

## Usage

### First-Time Setup

1. **Install the extension** using one of the methods above
2. **Click the extension icon** in the Chrome toolbar
3. **Sign in to Readspace**:
   - Choose "Sign In to Readspace" for guided auth flow
   - Or manually enter your access token
4. **Configure settings** (optional):
   - Set your Readspace instance URL
   - Configure default folders and tags

### Saving Articles

#### Via Extension Popup
1. Navigate to any article or webpage
2. Click the Readspace extension icon
3. Review the article preview
4. Click "Save to Readspace" or "Options" for advanced settings

#### Via Context Menu
- Right-click on any page: "Save to Readspace"
- Right-click on any link: "Save link to Readspace"
- Right-click on any page: "Discover RSS feeds"

#### Via Keyboard Shortcuts
- `Ctrl+Shift+S` (Windows/Linux) or `Cmd+Shift+S` (Mac): Save current page
- `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac): Open Readspace

### Managing Content

- **View recent articles** in the extension popup
- **Mark articles as read** with the eye icon
- **Open articles** in new tabs with the external link icon
- **Access full Readspace** via the header button

## API Integration

The extension integrates with Readspace via these endpoints:

- `POST /api/v1/articles/save` - Save new articles
- `GET /api/v1/articles/` - Fetch recent articles
- `PUT /api/v1/articles/{id}` - Update article status
- `GET /api/v1/folders/` - Get user folders
- `GET /api/v1/tags/` - Get user tags
- `POST /api/v1/feeds/discover` - Discover RSS feeds

## Authentication

The extension supports access token authentication:

1. **Generate a token** in your Readspace instance settings
2. **Enter the token** in the extension login form
3. The token is **stored securely** in Chrome's local storage
4. **Automatic renewal** (if supported by the API)

## Content Extraction

The extension uses intelligent content extraction powered by the [Defuddle library](https://github.com/kepano/defuddle):

- **Article content** using the official Defuddle library for clean, consistent HTML extraction
- **Metadata extraction** from Open Graph, Twitter Cards, and meta tags
- **Image detection** with smart filtering for hero images
- **Reading time estimation** based on word count
- **RSS feed discovery** from page links and common locations
- **Fallback algorithm** for sites where Defuddle might not work optimally

Defuddle is specifically designed to extract main content from web pages by removing clutter like comments, sidebars, headers, and footers, providing clean and consistent HTML output that's perfect for reading applications.

### Getting Help

1. **Check the browser console** (F12 → Console) for error messages
2. **Verify network requests** in the Network tab
3. **Submit an issue** with detailed steps to reproduce

## License

This extension is part of the Readspace project. See the main project LICENSE file for details.