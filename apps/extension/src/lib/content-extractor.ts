import { estimateReadingTime } from '@readspace/shared'
import Defuddle from 'defuddle'
import { sanitizeArticleHtml } from './sanitize-article-html'

export interface PageMetadata {
  title: string
  description: string
  author: string
  published_at: string
  image_url: string
  favicon: string
  canonical_url: string
  url: string
  domain: string
  estimated_read_time: number
}

export interface ArticleContent extends PageMetadata {
  content: string
  word_count: number
}

/** Minimum rendered/declared width for an in-article image to count as the hero */
const MIN_HERO_IMAGE_WIDTH = 300
const CONTENT_ROOT_SELECTOR = 'article, main, [role="main"]'

const IMAGE_META_SELECTORS = [
  'meta[property="og:image"]',
  'meta[property="og:image:secure_url"]',
  'meta[name="og:image"]',
  'meta[name="twitter:image"]',
  'meta[property="twitter:image"]',
  'meta[name="twitter:image:src"]',
  'meta[itemprop="image"]',
]
const TITLE_META_SELECTORS = [
  'meta[property="og:title"]',
  'meta[name="twitter:title"]',
]
const DESCRIPTION_META_SELECTORS = [
  'meta[property="og:description"]',
  'meta[name="description"]',
  'meta[name="twitter:description"]',
]
const AUTHOR_META_SELECTORS = [
  'meta[name="author"]',
  'meta[property="article:author"]',
]
const PUBLISHED_META_SELECTORS = [
  'meta[property="article:published_time"]',
  'meta[itemprop="datePublished"]',
  'meta[name="date"]',
]
const LAZY_IMAGE_ATTRIBUTES = ['data-src', 'data-lazy-src', 'data-original']
const ARTICLE_CONTENT_SELECTORS = [
  '[itemprop="articleBody"]',
  '.elementor-widget-theme-post-content > .elementor-widget-container',
  '.entry-content',
  '.post-content',
  '.article-content',
  '.article-body',
  '.post-body',
]

function findArticleContentSelector(doc: Document): string | undefined {
  return ARTICLE_CONTENT_SELECTORS.find((selector) =>
    doc.querySelector(selector)
  )
}

/**
 * Defuddle historically returns the full body when its extraction pipeline
 * throws. Reject content that still contains page-level executable resources,
 * viewport positioning, or multiple pieces of site chrome.
 */
function looksLikeWholePageFallback(content: string): boolean {
  if (!content) return false
  if (content.trim() === document.body.innerHTML.trim()) return true

  const template = document.createElement('template')
  template.innerHTML = content
  const root = template.content

  if (root.querySelector('script, style, link, meta, base, object, embed')) {
    return true
  }

  const hasViewportPositioning = Array.from(
    root.querySelectorAll<HTMLElement>('[style]')
  ).some((element) =>
    /(?:^|;)\s*position\s*:\s*(?:fixed|sticky)\b/i.test(
      element.getAttribute('style') || ''
    )
  )
  if (hasViewportPositioning) return true

  const chromeCount = root.querySelectorAll(
    'nav, header, footer, [class*="site-header"], [class*="site-footer"], [class*="main-menu"]'
  ).length
  return chromeCount > 1
}

function extractNarrowContent(root: Element): string {
  const narrowDocument = document.implementation.createHTMLDocument(
    document.title
  )
  const base = narrowDocument.createElement('base')
  base.href = document.baseURI
  narrowDocument.head.appendChild(base)
  narrowDocument.body.appendChild(narrowDocument.importNode(root, true))

  return new Defuddle(narrowDocument, {
    debug: false,
    url: window.location.href,
    removeExactSelectors: true,
    removePartialSelectors: true,
    includeReplies: false,
  }).parse().content
}

function toAbsoluteUrl(url: string | null | undefined): string {
  if (!url) return ''
  try {
    return new URL(url, document.baseURI).href
  } catch {
    return ''
  }
}

function getMetaContent(selectors: readonly string[]): string {
  for (const selector of selectors) {
    const value = document
      .querySelector<HTMLMetaElement>(selector)
      ?.getAttribute('content')
      ?.trim()
    if (value) return value
  }
  return ''
}

/** Resolve a schema.org `image` value (string, ImageObject, or array of either) */
function getSchemaImageUrl(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = getSchemaImageUrl(item)
      if (url) return url
    }
    return ''
  }
  if (value && typeof value === 'object') {
    const { url, contentUrl } = value as { url?: unknown; contentUrl?: unknown }
    if (typeof url === 'string') return url
    if (typeof contentUrl === 'string') return contentUrl
  }
  return ''
}

function getJsonLdImage(): string {
  const scripts = document.querySelectorAll(
    'script[type="application/ld+json"]'
  )
  for (const script of Array.from(scripts)) {
    let data: unknown
    try {
      data = JSON.parse(script.textContent || '')
    } catch {
      continue // Malformed JSON-LD is common; skip it
    }
    const roots = Array.isArray(data) ? data : [data]
    for (const root of roots) {
      const graph = (root as { '@graph'?: unknown } | null)?.['@graph']
      const entries = Array.isArray(graph) ? graph : [root]
      for (const entry of entries) {
        const node = entry as { image?: unknown; thumbnailUrl?: unknown } | null
        const url = getSchemaImageUrl(node?.image ?? node?.thumbnailUrl)
        if (url) return url
      }
    }
  }
  return ''
}

function getImageSource(img: HTMLImageElement): string {
  const candidates = [
    img.currentSrc,
    img.getAttribute('src'),
    ...LAZY_IMAGE_ATTRIBUTES.map((attr) => img.getAttribute(attr)),
  ]
  return candidates.find((src) => src && !src.startsWith('data:')) || ''
}

/** First sufficiently large image inside the article body — for pages without og:image */
function getContentHeroImage(): string {
  const root = document.querySelector(CONTENT_ROOT_SELECTOR) ?? document.body
  for (const img of Array.from(root.querySelectorAll('img'))) {
    const width =
      img.naturalWidth || img.width || Number(img.getAttribute('width')) || 0
    if (width < MIN_HERO_IMAGE_WIDTH) continue
    const src = getImageSource(img)
    if (src) return src
  }
  return ''
}

function findHeroImage(): string {
  return toAbsoluteUrl(
    getMetaContent(IMAGE_META_SELECTORS) ||
      getJsonLdImage() ||
      document.querySelector('link[rel="image_src"]')?.getAttribute('href') ||
      getContentHeroImage()
  )
}

function getFavicon(): string {
  const icon = document.querySelector(
    'link[rel~="icon"], link[rel="apple-touch-icon"]'
  )
  return toAbsoluteUrl(icon?.getAttribute('href') || '/favicon.ico')
}

/**
 * Cheap page metadata read straight from the DOM (meta tags, JSON-LD, images).
 * No Defuddle parse, so it stays well inside the popup's message timeout on heavy pages.
 */
export function extractPageMetadata(): PageMetadata {
  const contentRoot =
    document.querySelector(CONTENT_ROOT_SELECTOR) ?? document.body

  return {
    title: getMetaContent(TITLE_META_SELECTORS) || document.title || '',
    description: getMetaContent(DESCRIPTION_META_SELECTORS),
    author: getMetaContent(AUTHOR_META_SELECTORS),
    published_at: getMetaContent(PUBLISHED_META_SELECTORS),
    image_url: findHeroImage(),
    favicon: getFavicon(),
    canonical_url: window.location.href,
    url: window.location.href,
    domain: window.location.hostname,
    estimated_read_time: estimateReadingTime(contentRoot.textContent || ''),
  }
}

/**
 * Extract full article content with Defuddle, backfilling metadata from the DOM read
 */
export async function extractArticleContent(): Promise<ArticleContent> {
  const metadata = extractPageMetadata()
  const contentSelector = findArticleContentSelector(document)
  const result = new Defuddle(document, {
    debug: false,
    url: window.location.href,
    removeExactSelectors: true,
    removePartialSelectors: true,
    includeReplies: false,
    contentSelector,
  }).parse()

  let extractedContent = result.content || ''
  if (looksLikeWholePageFallback(extractedContent)) {
    const articleRoot = contentSelector
      ? document.querySelector(contentSelector)
      : null
    extractedContent = articleRoot ? extractNarrowContent(articleRoot) : ''
  }

  const content = sanitizeArticleHtml(extractedContent)
  const contentContainer = document.createElement('div')
  contentContainer.innerHTML = content
  const contentText = contentContainer.textContent || ''

  return {
    ...metadata,
    title: result.title || metadata.title,
    description: result.description || metadata.description,
    author: result.author || metadata.author,
    published_at: result.published || metadata.published_at,
    image_url: metadata.image_url || toAbsoluteUrl(result.image),
    favicon: toAbsoluteUrl(result.favicon) || metadata.favicon,
    domain: result.domain || metadata.domain,
    content,
    word_count: contentText.trim().split(/\s+/).filter(Boolean).length,
    estimated_read_time: estimateReadingTime(contentText),
  }
}
