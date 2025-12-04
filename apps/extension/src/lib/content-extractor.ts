import { estimateReadingTime } from '@readspace/shared'
import Defuddle from 'defuddle'

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
}

export interface ArticleContent extends PageMetadata {
  content: string
  word_count: number
  estimated_read_time: number
}

/**
 * Extract full article content and metadata using Defuddle
 */
export async function extractArticleContent(): Promise<ArticleContent> {
  const defuddle = new Defuddle(document, {
    debug: false,
    url: window.location.href,
    removeExactSelectors: true,
    removePartialSelectors: true,
  })

  const result = defuddle.parse()

  const content = result.content || ''

  const makeAbsolute = (url: string) => {
    try {
      return new URL(url, document.baseURI).href
    } catch {
      return url
    }
  }

  return {
    title: result.title || document.title || '',
    description: result.description || '',
    author: result.author || '',
    published_at: result.published || '',
    image_url: result.image ? makeAbsolute(result.image) : '',
    favicon: result.favicon ? makeAbsolute(result.favicon) : '',
    canonical_url: makeAbsolute(window.location.href),
    url: window.location.href,
    domain: result.domain || window.location.hostname,
    content,
    word_count: content.split(/\s+/).length,
    estimated_read_time: estimateReadingTime(content),
  }
}
