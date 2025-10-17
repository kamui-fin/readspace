import { QueryClient, useQuery } from "@tanstack/react-query";
import { ApiClient } from "../client";
import { ARTICLE_ENHANCEMENT_QUERY_KEYS } from "../query-keys";

// Re-export for convenience
export { ARTICLE_ENHANCEMENT_QUERY_KEYS };

// Response types for article enhancement endpoints
export type ExtractFullTextResponse = {
  success: boolean;
  content: string | null;
  estimated_read_time_minutes: number | null;
  error: string | null;
};

export type SummarizeResponse = {
  success: boolean;
  summary: string | null;
  error: string | null;
};

export type TranslateResponse = {
  success: boolean;
  translated_content: string | null;
  target_language: string | null;
  error: string | null;
};

// Request types
export type SummarizeRequest = {
  content?: string;
};

export type TranslateRequest = {
  target_language: string;
  content?: string;
};

/**
 * Hook for extracting full text content from article URL
 * 
 * Caching Strategy:
 * - Cache key includes articleId and optionally articleUrl hash
 * - If URL changes, extraction will be re-triggered (ensures fresh content)
 * - Cache is maintained for 30 minutes with 1 hour garbage collection
 */
export function useExtractFullText(articleId: string, articleUrl?: string) {
  // Validate that we have a proper article ID (not empty, skip, etc.)
  const isValidArticleId =
    articleId && articleId !== "skip" && articleId.length > 0;

  // Create URL hash for cache key to ensure re-extraction if URL changes
  const urlHash = articleUrl ? createContentHash(articleUrl) : "no-url";

  return useQuery({
    queryKey: [
      ARTICLE_ENHANCEMENT_QUERY_KEYS.EXTRACTED_CONTENT,
      articleId,
      urlHash,
    ],
    queryFn: async (): Promise<ExtractFullTextResponse> => {
      if (!isValidArticleId) {
        throw new Error("Invalid article ID");
      }
      const response = await ApiClient.post<ExtractFullTextResponse>(
        `/api/articles/${articleId}/extract-full-text`,
      );
      return response;
    },
    enabled: false, // Only run when manually triggered
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });
}

/**
 * Helper function to create a safe content hash
 */
function createContentHash(content: string): string {
  try {
    // Use a simple hash based on content length and first/last chars
    const snippet =
      content.substring(0, 50) + content.substring(content.length - 50);
    // Create a simple numeric hash to avoid btoa issues
    let hash = 0;
    for (let i = 0; i < snippet.length; i++) {
      const char = snippet.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `${content.length}-${Math.abs(hash)}`;
  } catch {
    return `${content.length}-${Date.now()}`;
  }
}

/**
 * Hook for generating AI summaries of articles
 * 
 * Caching Strategy:
 * - Cache key includes articleId and content hash
 * - Same content will reuse cached summary (avoids duplicate AI calls)
 * - Different content (original vs extracted) gets separate cache entries
 * - Cache is maintained for 30 minutes with 1 hour garbage collection
 * 
 * @param articleId - The article ID
 * @param content - The content to summarize (if not provided, uses article's original content)
 */
export function useSummarizeArticle(articleId: string, content?: string) {
  // Validate that we have a proper article ID (not empty, skip, etc.)
  const isValidArticleId =
    articleId && articleId !== "skip" && articleId.length > 0;

  // Create a content hash for cache key - ensures same content reuses cache
  const contentHash = content ? createContentHash(content) : "original";

  return useQuery({
    queryKey: [ARTICLE_ENHANCEMENT_QUERY_KEYS.SUMMARY, articleId, contentHash],
    queryFn: async (): Promise<SummarizeResponse> => {
      if (!isValidArticleId) {
        throw new Error("Invalid article ID");
      }
      const requestBody: SummarizeRequest = content ? { content } : {};
      const response = await ApiClient.post<SummarizeResponse>(
        `/api/articles/${articleId}/summarize`,
        requestBody,
      );
      return response;
    },
    enabled: false, // Only run when manually triggered
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });
}

/**
 * Helper function to create translation query key
 * 
 * Caching Strategy:
 * - Cache key includes articleId, targetLanguage, and content hash
 * - Same content + language combo reuses cached translation
 * - Different source content (original vs extracted) gets separate cache
 * - Different target languages get separate cache entries
 * 
 * @param articleId - The article ID
 * @param targetLanguage - Target language code (e.g., 'es', 'fr', 'de')
 * @param content - The content to translate (if not provided, uses article's original content)
 */
export function createTranslationQueryKey(
  articleId: string,
  targetLanguage: string,
  content?: string,
) {
  const contentHash = content ? createContentHash(content) : "original";
  return [
    ARTICLE_ENHANCEMENT_QUERY_KEYS.TRANSLATION,
    articleId,
    targetLanguage,
    contentHash,
  ];
}

/**
 * Helper function to fetch translation with caching
 * 
 * Uses TanStack Query's fetchQuery to leverage cache-first strategy.
 * If translation exists in cache, returns immediately without API call.
 */
export async function fetchTranslation(
  queryClient: QueryClient,
  articleId: string,
  targetLanguage: string,
  content?: string,
): Promise<TranslateResponse> {
  // Validate that we have a proper article ID (not empty, skip, etc.)
  const isValidArticleId =
    articleId && articleId !== "skip" && articleId.length > 0;

  if (!isValidArticleId) {
    throw new Error("Invalid article ID for translation");
  }

  const queryKey = createTranslationQueryKey(
    articleId,
    targetLanguage,
    content,
  );

  return await queryClient.fetchQuery({
    queryKey,
    queryFn: async (): Promise<TranslateResponse> => {
      const requestBody: TranslateRequest = {
        target_language: targetLanguage,
        ...(content && { content }),
      };
      const response = await ApiClient.post<TranslateResponse>(
        `/api/articles/${articleId}/translate`,
        requestBody,
      );
      return response;
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}
