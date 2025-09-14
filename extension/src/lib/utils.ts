import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatReadingTime(minutes: number): string {
  if (minutes < 1) return "< 1 min read"
  if (minutes === 1) return "1 min read"
  return `${Math.round(minutes)} min read`
}

export function formatDate(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays} days ago`
  
  return date.toLocaleDateString()
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

/**
 * Check if text contains significant CJK (Chinese, Japanese, Korean) characters.
 */
function isCJKText(text: string): boolean {
  if (!text.trim()) return false
  
  // CJK Unicode ranges
  const cjkPattern = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff\uac00-\ud7af\uff00-\uffef]/g
  
  // Remove whitespace and count total characters
  const nonWhitespace = text.replace(/\s+/g, '')
  if (nonWhitespace.length === 0) return false
  
  // Count CJK characters
  const cjkMatches = text.match(cjkPattern)
  const cjkChars = cjkMatches ? cjkMatches.length : 0
  
  // Consider text CJK if more than 20% of characters are CJK
  return (cjkChars / nonWhitespace.length) > 0.2
}

export function estimateReadingTime(text: string): number {
  const cleanText = text.trim()
  if (!cleanText) return 1
  
  if (isCJKText(cleanText)) {
    // For CJK text, count characters (excluding whitespace)
    const charactersPerMinute = 300
    const charCount = cleanText.replace(/\s+/g, '').length
    return Math.max(1, Math.round(charCount / charactersPerMinute))
  } else {
    // For non-CJK text, count words
    const wordsPerMinute = 200
    const wordCount = cleanText.split(/\s+/).length
    return Math.max(1, Math.round(wordCount / wordsPerMinute))
  }
} 