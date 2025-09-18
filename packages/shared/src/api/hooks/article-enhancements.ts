import { useQuery, QueryClient } from "@tanstack/react-query";
import { ARTICLE_ENHANCEMENT_QUERY_KEYS } from "../query-keys";
import { ApiClient } from "../client";

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
 */
export function useExtractFullText(articleId: string) {
  return useQuery({
    queryKey: [ARTICLE_ENHANCEMENT_QUERY_KEYS.EXTRACTED_CONTENT, articleId],
    queryFn: async (): Promise<ExtractFullTextResponse> => {
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
 */
export function useSummarizeArticle(articleId: string, content?: string) {
  // Create a content hash for cache key
  const contentHash = content ? createContentHash(content) : "original";

  return useQuery({
    queryKey: [ARTICLE_ENHANCEMENT_QUERY_KEYS.SUMMARY, articleId, contentHash],
    queryFn: async (): Promise<SummarizeResponse> => {
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
 */
export async function fetchTranslation(
  queryClient: QueryClient,
  articleId: string,
  targetLanguage: string,
  content?: string,
): Promise<TranslateResponse> {
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
