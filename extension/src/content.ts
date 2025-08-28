// Content script for Readspace extension

if (typeof (globalThis as any).readspaceContentScriptHasRun === 'undefined') {
  ;(globalThis as any).readspaceContentScriptHasRun = true

  console.log('Readspace content script loaded')

  // Message listener for popup and background script requests
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    switch (request.action) {
      case 'extractMetadata':
        sendResponse(extractPageMetadata())
        break
      case 'extractContent':
        extractArticleContent()
          .then(sendResponse)
          .catch(error => sendResponse({ error: error.message }))
        return true // Keep message channel open for async response
      case 'discoverFeeds':
        sendResponse(discoverRSSFeeds())
        break
    }
  })

  /**
   * Extract basic metadata from the current page
   */
  function extractPageMetadata() {
    const metadata = {
      title: getTitle(),
      description: getDescription(),
      author: getAuthor(),
      published_at: getPublishedDate(),
      image_url: getImageUrl(),
      favicon: getFavicon(),
      canonical_url: getCanonicalUrl(),
      feeds: discoverRSSFeeds(),
    }

    return metadata
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
      .filter(img => {
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
   * Discover RSS feeds on the current page
   */
  function discoverRSSFeeds() {
    const feeds: Array<{ url: string; title?: string; type: string }> = []

    // Look for feed links in the head
    const feedLinks = document.querySelectorAll(
      'link[type="application/rss+xml"], link[type="application/atom+xml"], link[type="application/json"], link[rel="alternate"]',
    )

    console.log('Feed discovery: found', feedLinks.length, 'feed links')

    feedLinks.forEach(link => {
      const href = link.getAttribute('href')
      const title = link.getAttribute('title')
      const type = link.getAttribute('type')
      const rel = link.getAttribute('rel')

      console.log('Checking feed link:', { href, title, type, rel })

      // Include alternate links that might be feeds
      if (href && (
        type?.includes('rss') || 
        type?.includes('atom') || 
        type?.includes('json') ||
        (rel === 'alternate' && type?.includes('xml'))
      )) {
        const feedType = type?.includes('atom') 
          ? 'atom' 
          : type?.includes('json') 
            ? 'json' 
            : 'rss'
            
        feeds.push({
          url: makeAbsoluteUrl(href),
          title: title || undefined,
          type: feedType,
        })
        console.log('Added feed:', makeAbsoluteUrl(href))
      }
    })

    console.log('Feed discovery complete. Found', feeds.length, 'feeds:', feeds)
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
        result.content?.substring(0, 500),
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
        extractedData.content?.length || 0,
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
          `Found content using selector '${selector}', length: ${content.length}`,
        )
        if (content.length > 200) break
      }
    }

    // If still no content, try to get all paragraphs as HTML
    if (!content) {
      console.log('No content found with selectors, trying paragraph extraction...')
      const paragraphs = Array.from(document.querySelectorAll('p'))
        .filter(p => {
          const text = p.textContent?.trim()
          return text && text.length > 50
        })
        .slice(0, 10) // Limit to first 10 paragraphs

      content = paragraphs.map(p => p.outerHTML).join('\n')
      console.log(
        `Extracted ${paragraphs.length} paragraphs, total HTML length: ${content.length}`,
      )
    }

    const result = {
      content, // HTML content, not just text
      title: getTitle(),
      description: getDescription(),
      author: getAuthor(),
      published_at: getPublishedDate(),
      image_url: getImageUrl(),
      estimated_read_time: estimateReadingTime(
        content.replace(/<[^>]*>/g, ''),
      ), // Strip HTML for word count
    }

    console.log('Basic extraction complete:', {
      contentLength: result.content.length,
      contentPreview: result.content.substring(0, 200) + '...',
    })

    return result
  }

  function estimateReadingTime(text: string): number {
    const wordsPerMinute = 200
    const wordCount = text.split(/\s+/).length
    return Math.max(1, Math.round(wordCount / wordsPerMinute))
  }
} 