// Content script for Readspace extension

// Extend globalThis with our extension property
interface ExtendedGlobalThis {
  readspaceContentScriptHasRun?: boolean
}

const extendedGlobal = globalThis as ExtendedGlobalThis

if (typeof extendedGlobal.readspaceContentScriptHasRun === 'undefined') {
  extendedGlobal.readspaceContentScriptHasRun = true

  console.log('Readspace content script loaded')

  // Message listener for popup and background script requests
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    switch (request.action) {
      case 'extractMetadata':
        // Fast extraction - discover feeds in background
        extractPageMetadataFast()
          .then(sendResponse)
          .catch((error) => sendResponse({ error: error.message }))
        return true // Keep message channel open for async response
      case 'extractContent':
        extractArticleContent()
          .then(sendResponse)
          .catch((error) => sendResponse({ error: error.message }))
        return true // Keep message channel open for async response
      case 'discoverFeeds':
        discoverRSSFeeds()
          .then(sendResponse)
          .catch((error) => sendResponse({ error: error.message }))
        return true // Keep message channel open for async response
    }
  })

  /**
   * Extract basic metadata from the current page (FAST - no feed validation)
   */
  async function extractPageMetadataFast() {
    // Discover feeds quickly without validation for faster response
    const feeds = await discoverRSSFeedsFast()

    const metadata = {
      title: getTitle(),
      description: getDescription(),
      author: getAuthor(),
      published_at: getPublishedDate(),
      image_url: getImageUrl(),
      favicon: getFavicon(),
      canonical_url: getCanonicalUrl(),
      feeds: feeds,
    }

    return metadata
  }

  /**
   * Discover RSS feeds quickly without validation (for fast popup display)
   */
  async function discoverRSSFeedsFast() {
    const feeds: Array<{ url: string; title?: string; type: string }> = []
    const discoveredUrls = new Set<string>()

    // Phase 1: Check link tags - ONLY proper RSS/Atom feed link tags with rel="alternate"
    const feedLinks = document.querySelectorAll(
      [
        'link[rel="alternate"][type="application/rss+xml"]',
        'link[rel="alternate"][type="application/atom+xml"]',
        'link[rel="alternate"][type="application/json"]',
        'link[rel="alternate"][type="application/feed+json"]',
        'link[type="application/rss+xml"]',
        'link[type="application/atom+xml"]',
      ].join(', ')
    )

    for (const link of feedLinks) {
      const href = link.getAttribute('href')
      const title = link.getAttribute('title')
      const type = link.getAttribute('type')

      if (href) {
        const absoluteUrl = makeAbsoluteUrl(href)

        // Skip if URL looks like a static asset file
        if (absoluteUrl.match(/\.(jpg|jpeg|png|gif|svg|webp|ico|js|css|woff|woff2|ttf|eot|mp4|webm|pdf)(\?.*)?$/i)) {
          console.log('Skipping asset file:', absoluteUrl)
          continue
        }

        // Skip if URL contains common asset directory patterns
        if (absoluteUrl.match(/\/(static|assets|images?|img|media|js|css|fonts?|dist|build)\//i)) {
          console.log('Skipping asset directory:', absoluteUrl)
          continue
        }

        if (!discoveredUrls.has(absoluteUrl)) {
          discoveredUrls.add(absoluteUrl)
          const feedType = type?.includes('atom')
            ? 'atom'
            : type?.includes('json')
              ? 'json'
              : 'rss'

          feeds.push({
            url: absoluteUrl,
            title: title || undefined,
            type: feedType,
          })
        }
      }
    }

    // Phase 2: Add common RSS URL patterns without validation (fast heuristics)
    // Only suggest if NO feeds were found in link tags
    if (feeds.length === 0) {
      const baseUrl = window.location.origin
      const currentPath = window.location.pathname

      // Only suggest the most common patterns (limit to 2 suggestions)
      const feedPatterns = [
        '/rss',
        '/feed',
      ]

      // Add blog-specific pattern if we're on a blog/article
      if (currentPath.includes('/blog/') || currentPath.includes('/post/') || currentPath.includes('/article/')) {
        const pathParts = currentPath.split('/').filter(p => p)
        if (pathParts.length >= 1) {
          const blogPath = '/' + pathParts[0]
          // Prepend blog-specific pattern as first choice
          feedPatterns.unshift(`${blogPath}/feed`)
        }
      }

      // Add only the first 2 patterns without validation
      for (const pattern of feedPatterns.slice(0, 2)) {
        const testUrl = baseUrl + pattern
        if (!discoveredUrls.has(testUrl)) {
          discoveredUrls.add(testUrl)
          feeds.push({
            url: testUrl,
            title: undefined,
            type: 'rss',
          })
        }
      }
    }

    return feeds
  }

  function getTitle(): string {
    // Try Open Graph title first
    const ogTitle = document
      .querySelector('meta[property="og:title"]')
      ?.getAttribute('content')
    if (ogTitle) return ogTitle

    // Try Twitter title
    const twitterTitle = document
      .querySelector('meta[name="twitter:title"]')
      ?.getAttribute('content')
    if (twitterTitle) return twitterTitle

    // Fall back to document title
    return document.title || ''
  }

  function getDescription(): string {
    // Try Open Graph description first
    const ogDescription = document
      .querySelector('meta[property="og:description"]')
      ?.getAttribute('content')
    if (ogDescription) return ogDescription

    // Try meta description
    const metaDescription = document
      .querySelector('meta[name="description"]')
      ?.getAttribute('content')
    if (metaDescription) return metaDescription

    // Try Twitter description
    const twitterDescription = document
      .querySelector('meta[name="twitter:description"]')
      ?.getAttribute('content')
    if (twitterDescription) return twitterDescription

    // Try to extract from first paragraph
    const firstParagraph = document.querySelector('p')?.textContent?.trim()
    if (firstParagraph && firstParagraph.length > 50) {
      return (
        firstParagraph.substring(0, 200) +
        (firstParagraph.length > 200 ? '...' : '')
      )
    }

    return ''
  }

  function getAuthor(): string {
    // Try various author meta tags
    const authorSelectors = [
      'meta[name="author"]',
      'meta[property="article:author"]',
      'meta[name="article:author"]',
      'meta[name="twitter:creator"]',
      '[rel="author"]',
    ]

    for (const selector of authorSelectors) {
      const element = document.querySelector(selector)
      const content = element?.getAttribute('content') || element?.textContent
      if (content?.trim()) return content.trim()
    }

    return ''
  }

  function getPublishedDate(): string {
    // Try various date meta tags
    const dateSelectors = [
      'meta[property="article:published_time"]',
      'meta[name="article:published_time"]',
      'meta[name="date"]',
      'meta[name="publish-date"]',
      'meta[property="og:updated_time"]',
      'time[datetime]',
    ]

    for (const selector of dateSelectors) {
      const element = document.querySelector(selector)
      const content =
        element?.getAttribute('content') || element?.getAttribute('datetime')
      if (content?.trim()) return content.trim()
    }

    return ''
  }

  function getImageUrl(): string {
    // Try Open Graph image first
    const ogImage = document
      .querySelector('meta[property="og:image"]')
      ?.getAttribute('content')
    if (ogImage) return makeAbsoluteUrl(ogImage)

    // Try Twitter image
    const twitterImage = document
      .querySelector('meta[name="twitter:image"]')
      ?.getAttribute('content')
    if (twitterImage) return makeAbsoluteUrl(twitterImage)

    // Try to find the largest image in the article
    const images = Array.from(document.querySelectorAll('img'))
    const articleImages = images
      .filter((img) => {
        const src = img.src
        const alt = img.alt || ''
        const width =
          img.naturalWidth || parseInt(img.getAttribute('width') || '0')
        const height =
          img.naturalHeight || parseInt(img.getAttribute('height') || '0')

        // Filter out small images, icons, and common non-content images
        return (
          width > 200 &&
          height > 100 &&
          !src.includes('icon') &&
          !src.includes('logo') &&
          !alt.toLowerCase().includes('logo')
        )
      })
      .sort((a, b) => {
        const aSize = (a.naturalWidth || 0) * (a.naturalHeight || 0)
        const bSize = (b.naturalWidth || 0) * (b.naturalHeight || 0)
        return bSize - aSize
      })

    if (articleImages.length > 0) {
      return makeAbsoluteUrl(articleImages[0].src)
    }

    return ''
  }

  function getFavicon(): string {
    // Try to find favicon
    const iconSelectors = [
      'link[rel="icon"]',
      'link[rel="shortcut icon"]',
      'link[rel="apple-touch-icon"]',
    ]

    for (const selector of iconSelectors) {
      const href = document.querySelector(selector)?.getAttribute('href')
      if (href) return makeAbsoluteUrl(href)
    }

    // Default favicon location
    return makeAbsoluteUrl('/favicon.ico')
  }

  function getCanonicalUrl(): string {
    const canonical = document
      .querySelector('link[rel="canonical"]')
      ?.getAttribute('href')
    if (canonical) return makeAbsoluteUrl(canonical)

    return window.location.href
  }

  function makeAbsoluteUrl(url: string): string {
    if (!url) return ''
    if (url.startsWith('http')) return url
    if (url.startsWith('//')) return window.location.protocol + url
    if (url.startsWith('/')) return window.location.origin + url
    return new URL(url, window.location.href).href
  }

  /**
   * Validate if a URL is a valid RSS/Atom feed using HEAD request
   */
  async function validateFeed(
    url: string
  ): Promise<{ isValid: boolean; error?: string }> {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
        headers: {
          'User-Agent': 'Readspace Extension Feed Validator',
        },
      })

      if (!response.ok) {
        return { isValid: false, error: `HTTP ${response.status}` }
      }

      const contentType =
        response.headers.get('content-type')?.toLowerCase() || ''

      // Check if content type indicates a feed
      const isFeed =
        contentType.includes('xml') ||
        contentType.includes('rss') ||
        contentType.includes('atom') ||
        contentType.includes('json') ||
        contentType.includes('application/rss') ||
        contentType.includes('application/atom')

      return {
        isValid: isFeed,
        error: isFeed ? undefined : 'Invalid content type',
      }
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Validation failed',
      }
    }
  }

  /**
   * Discover RSS feeds on the current page with validation
   */
  async function discoverRSSFeeds() {
    const feeds: Array<{ url: string; title?: string; type: string }> = []
    const discoveredUrls = new Set<string>()

    console.log('=== Starting RSS Feed Discovery ===')

    // Phase 1: Enhanced link tag detection
    const feedLinks = document.querySelectorAll(
      [
        'link[type="application/rss+xml"]',
        'link[type="application/atom+xml"]',
        'link[type="application/json"]',
        'link[type="application/feed+json"]',
        'link[rel="alternate"][type*="xml"]',
        'link[rel="alternate"][type*="rss"]',
        'link[rel="alternate"][type*="atom"]',
        'link[href*="feed"]',
        'link[href*="rss"]',
        'link[href*="atom"]',
      ].join(', ')
    )

    console.log(
      'Feed discovery: found',
      feedLinks.length,
      'potential feed links'
    )

    // Process link tags first
    for (const link of feedLinks) {
      const href = link.getAttribute('href')
      const title = link.getAttribute('title')
      const type = link.getAttribute('type')

      if (href) {
        const absoluteUrl = makeAbsoluteUrl(href)
        if (!discoveredUrls.has(absoluteUrl)) {
          discoveredUrls.add(absoluteUrl)

          console.log('Validating link tag feed:', absoluteUrl)
          const validation = await validateFeed(absoluteUrl)

          if (validation.isValid) {
            const feedType = type?.includes('atom')
              ? 'atom'
              : type?.includes('json')
                ? 'json'
                : 'rss'

            feeds.push({
              url: absoluteUrl,
              title: title || undefined,
              type: feedType,
            })
            console.log('✓ Valid feed found via link tag:', absoluteUrl)
          } else {
            console.log(
              '✗ Invalid feed from link tag:',
              absoluteUrl,
              validation.error
            )
          }
        }
      }
    }

    // Phase 2: Heuristic URL pattern discovery (only if we found few feeds)
    if (feeds.length < 3) {
      console.log('Running heuristic discovery for additional feeds...')

      const baseUrl = window.location.origin
      const currentPath = window.location.pathname

      // Common feed patterns to try
      const feedPatterns = ['/feed', '/feed/', '/rss', '/rss.xml', '/atom.xml']

      // Add blog-specific patterns if we're on a blog
      if (currentPath.includes('/blog/') || currentPath.includes('/post/')) {
        const blogPath = currentPath.split('/').slice(0, 2).join('/')
        feedPatterns.unshift(`${blogPath}/feed`, `${blogPath}/rss`)
      }

      for (const pattern of feedPatterns.slice(0, 5)) {
        const testUrl = baseUrl + pattern
        if (!discoveredUrls.has(testUrl)) {
          discoveredUrls.add(testUrl)

          console.log('Testing heuristic pattern:', testUrl)
          const validation = await validateFeed(testUrl)

          if (validation.isValid) {
            feeds.push({
              url: testUrl,
              title: undefined,
              type: 'rss',
            })
            console.log('✓ Valid feed found via heuristic:', testUrl)
          }
        }
      }
    }

    // Phase 3: Content-based feed link discovery (limited)
    if (feeds.length < 2) {
      console.log('Scanning page content for feed links...')

      const contentFeedLinks = document.querySelectorAll(
        [
          'a[href*="/feed"]',
          'a[href*="/rss"]',
          'a[href*="/atom"]',
          '.rss-link',
          '.feed-link',
        ].join(', ')
      )

      for (const link of Array.from(contentFeedLinks).slice(0, 3)) {
        const href = link.getAttribute('href')
        if (href) {
          const absoluteUrl = makeAbsoluteUrl(href)
          if (!discoveredUrls.has(absoluteUrl)) {
            discoveredUrls.add(absoluteUrl)

            console.log('Validating content feed link:', absoluteUrl)
            const validation = await validateFeed(absoluteUrl)

            if (validation.isValid) {
              feeds.push({
                url: absoluteUrl,
                title: link.textContent?.trim() || undefined,
                type: 'rss',
              })
              console.log('✓ Valid feed found in content:', absoluteUrl)
            }
          }
        }
      }
    }

    console.log('=== Feed Discovery Complete ===')
    console.log(
      `Found ${feeds.length} valid feeds out of ${discoveredUrls.size} tested URLs`
    )

    return feeds
  }

  /**
   * Extract article content using the actual Defuddle library
   */
  async function extractArticleContent() {
    console.log('=== Starting article content extraction ===')

    try {
      // Use dynamic import to load Defuddle library
      const { default: Defuddle } = await import('defuddle')
      console.log('Defuddle library loaded successfully')

      // Create Defuddle instance with options
      const defuddle = new Defuddle(document, {
        debug: true, // Enable debug mode
        url: window.location.href,
        removeExactSelectors: true,
        removePartialSelectors: true,
      })

      console.log('Defuddle instance created, starting extraction...')

      // Extract content using Defuddle
      const result = defuddle.parse()

      console.log('=== DEFUDDLE EXTRACTION RESULT ===')
      console.log('Content length:', result.content?.length || 0)
      console.log(
        'Content preview (first 500 chars):',
        result.content?.substring(0, 500)
      )
      console.log('Title:', result.title)
      console.log('Description:', result.description)
      console.log('Author:', result.author)
      console.log('Published:', result.published)
      console.log('Image:', result.image)
      console.log('Full Defuddle result object:', result)
      console.log('=== END DEFUDDLE RESULT ===')

      const extractedData = {
        content: result.content || '', // This should be the cleaned HTML content
        title: result.title || getTitle(),
        description: result.description || getDescription(),
        author: result.author || getAuthor(),
        published_at: result.published || getPublishedDate(),
        image_url: result.image || getImageUrl(),
        estimated_read_time: estimateReadingTime(result.content || ''),
      }

      console.log('Final extracted data being returned:', extractedData)
      console.log(
        'Content will be sent to backend - length:',
        extractedData.content?.length || 0
      )
      return extractedData
    } catch (error) {
      console.error('=== DEFUDDLE FAILED ===')
      console.error('Error:', error)
      console.log('Falling back to basic content extraction...')

      const fallbackData = basicContentExtraction()
      console.log('Fallback extraction result:', fallbackData)
      return fallbackData
    }
  }

  function basicContentExtraction() {
    console.log('Running basic content extraction as fallback...')

    // Basic content extraction as fallback
    const contentSelectors = [
      'article',
      '[role="main"]',
      '.post-content',
      '.entry-content',
      '.content',
      'main',
    ]

    let content = ''
    for (const selector of contentSelectors) {
      const element = document.querySelector(selector)
      if (element) {
        content = element.innerHTML?.trim() || '' // Get HTML, not just text
        console.log(
          `Found content using selector '${selector}', length: ${content.length}`
        )
        if (content.length > 200) break
      }
    }

    // If still no content, try to get all paragraphs as HTML
    if (!content) {
      console.log(
        'No content found with selectors, trying paragraph extraction...'
      )
      const paragraphs = Array.from(document.querySelectorAll('p'))
        .filter((p) => {
          const text = p.textContent?.trim()
          return text && text.length > 50
        })
        .slice(0, 10) // Limit to first 10 paragraphs

      content = paragraphs.map((p) => p.outerHTML).join('\n')
      console.log(
        `Extracted ${paragraphs.length} paragraphs, total HTML length: ${content.length}`
      )
    }

    const result = {
      content, // HTML content, not just text
      title: getTitle(),
      description: getDescription(),
      author: getAuthor(),
      published_at: getPublishedDate(),
      image_url: getImageUrl(),
      estimated_read_time: estimateReadingTime(content.replace(/<[^>]*>/g, '')), // Strip HTML for word count
    }

    console.log('Basic extraction complete:', {
      contentLength: result.content.length,
      contentPreview: result.content.substring(0, 200) + '...',
    })

    return result
  }

  function estimateReadingTime(text: string): number {
    const cleanText = text.trim()
    if (!cleanText) return 1

    // Check if text contains significant CJK characters
    const cjkPattern =
      /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff\uac00-\ud7af\uff00-\uffef]/g
    const nonWhitespace = cleanText.replace(/\s+/g, '')

    if (nonWhitespace.length > 0) {
      const cjkMatches = cleanText.match(cjkPattern)
      const cjkChars = cjkMatches ? cjkMatches.length : 0

      // Consider text CJK if more than 20% of characters are CJK
      if (cjkChars / nonWhitespace.length > 0.2) {
        // For CJK text, count characters (excluding whitespace)
        const charactersPerMinute = 300
        const charCount = nonWhitespace.length
        return Math.max(1, Math.round(charCount / charactersPerMinute))
      }
    }

    // For non-CJK text, count words
    const wordsPerMinute = 200
    const wordCount = cleanText.split(/\s+/).length
    return Math.max(1, Math.round(wordCount / wordsPerMinute))
  }
}
