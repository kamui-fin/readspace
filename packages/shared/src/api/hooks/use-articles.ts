import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryFunctionContext,
  type UseInfiniteQueryOptions,
  type UseMutationOptions,
  type UseQueryOptions,
  type InfiniteData,
} from "@tanstack/react-query";
import { ApiClient } from "../client";
import {
  ARTICLE_ENHANCEMENT_QUERY_KEYS,
  RSS_QUERY_KEYS,
  mutationKeys,
  queryKeys,
} from "../query-keys";
import type {
  Article,
  ArticleCountsResponse,
  ArticleSummary,
  CheckArticleSavedResponse,
  ExtractFullTextResponse,
  SaveArticleResponse,
  SummarizeRequest,
  SummarizeResponse,
  TranslateRequest,
  TranslateResponse,
} from "../types";

// Re-export for convenience
export { ARTICLE_ENHANCEMENT_QUERY_KEYS };

/**
 * Helper function to create a safe content hash
 */
function createContentHash(content: string): string {
  try {
    const snippet =
      content.substring(0, 50) + content.substring(content.length - 50);
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
 * Helper function to create translation query key
 */
export function createTranslationQueryKey(
  articleId: string,
  targetLanguage: string,
  content?: string,
) {
  const contentHash = content ? createContentHash(content) : "original";
  return queryKeys.translation(articleId, targetLanguage, contentHash);
}

export function useUnreadCounts(
  options?: Omit<
    UseQueryOptions<
      ArticleCountsResponse,
      Error,
      ArticleCountsResponse,
      ReturnType<typeof queryKeys.unreadCounts>
    >,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: queryKeys.unreadCounts(),
    queryFn: () => ApiClient.getUnreadCounts(),
    ...options,
  });
}

export function useArticle(
  articleId: string,
  options?: Omit<
    UseQueryOptions<
      Article,
      Error,
      Article,
      ReturnType<typeof queryKeys.article>
    >,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: queryKeys.article(articleId),
    queryFn: () => ApiClient.getArticle(articleId),
    enabled: !!articleId,
    ...options,
  });
}

export function useUpdateArticle(
  options?: UseMutationOptions<
    void,
    unknown,
    {
      articleId: string;
      data: {
        is_read?: boolean;
        is_saved?: boolean;
        priority?: string;
        note?: string | null;
      };
    },
    unknown
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.updateArticle(),
    mutationFn: async ({
      articleId,
      data,
    }: {
      articleId: string;
      data: {
        is_read?: boolean;
        is_saved?: boolean;
        priority?: string;
        note?: string | null;
      };
    }): Promise<void> => {
      // Map frontend fields to backend fields
      const updateData: any = { ...data };

      // Handle field mapping
      if (data.note !== undefined) {
        updateData.user_note = data.note;
        delete updateData.note;
      }

      await ApiClient.updateArticle(articleId, updateData);
    },
    onSettled: (_data, _error, { articleId }) => {
      // Invalidate article
      queryClient.invalidateQueries({
        queryKey: queryKeys.article(articleId),
      });

      // Invalidate check queries (for extension popup)
      queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === RSS_QUERY_KEYS.ARTICLE &&
          typeof query.queryKey[1] === "string" &&
          query.queryKey[1].startsWith("check-"),
      });

      // Invalidate article lists
      queryClient.invalidateQueries({
        queryKey: [RSS_QUERY_KEYS.ARTICLES],
      });

      // Invalidate counts
      queryClient.invalidateQueries({
        queryKey: queryKeys.unreadCounts(),
      });
    },
    ...options,
  });
}

// Infinite Query Hooks
export function useInfiniteArticles(
  params: {
    feedId?: string;
    folderId?: string;
    limit?: number;
    isRead?: boolean;
    isReadLater?: boolean;
  },
  options?: Omit<
    UseInfiniteQueryOptions<
      {
        items: ArticleSummary[];
        next_cursor: string | null;
        has_more: boolean;
        total_count: number | null;
      },
      Error,
      InfiniteData<{
        items: ArticleSummary[];
        next_cursor: string | null;
        has_more: boolean;
        total_count: number | null;
      }>,
      ReturnType<typeof queryKeys.infiniteArticles>,
      string | null
    >,
    "queryKey" | "queryFn" | "getNextPageParam" | "initialPageParam"
  >,
) {
  return useInfiniteQuery({
    queryKey: queryKeys.infiniteArticles(params),
    queryFn: ({
      pageParam,
    }: QueryFunctionContext<
      ReturnType<typeof queryKeys.infiniteArticles>,
      string | null
    >) =>
      ApiClient.getArticles({
        feed_id: params.feedId,
        folder_id: params.folderId,
        cursor: pageParam || undefined,
        limit: params.limit || 25,
        is_read: params.isRead,
        is_saved: params.isReadLater,
      }),
    getNextPageParam: (lastPage: {
      items: ArticleSummary[];
      next_cursor: string | null;
      has_more: boolean;
      total_count: number | null;
    }) => lastPage.next_cursor,
    initialPageParam: null,
    ...options,
  });
}

export function useInfiniteRecentlyReadArticles(
  params: { limit?: number } = {},
  options?: Omit<
    UseInfiniteQueryOptions<
      {
        items: ArticleSummary[];
        next_cursor: string | null;
        has_more: boolean;
        total_count: number | null;
      },
      Error,
      InfiniteData<{
        items: ArticleSummary[];
        next_cursor: string | null;
        has_more: boolean;
        total_count: number | null;
      }>,
      ReturnType<typeof queryKeys.infiniteRecentlyRead>,
      string | null
    >,
    "queryKey" | "queryFn" | "getNextPageParam" | "initialPageParam"
  >,
) {
  const limit = params.limit || 25;
  return useInfiniteQuery({
    queryKey: queryKeys.infiniteRecentlyRead(),
    queryFn: ({
      pageParam,
    }: QueryFunctionContext<
      ReturnType<typeof queryKeys.infiniteRecentlyRead>,
      string | null
    >) =>
      ApiClient.getRecentlyReadArticles({
        cursor: pageParam || undefined,
        limit,
      }),
    getNextPageParam: (lastPage: {
      items: ArticleSummary[];
      next_cursor: string | null;
      has_more: boolean;
      total_count: number | null;
    }) => lastPage.next_cursor,
    initialPageParam: null,
    ...options,
  });
}

export function useInfiniteReadLaterArticles(
  params: { limit?: number } = {},
  options?: Omit<
    UseInfiniteQueryOptions<
      {
        items: ArticleSummary[];
        next_cursor: string | null;
        has_more: boolean;
        total_count: number | null;
      },
      Error,
      InfiniteData<{
        items: ArticleSummary[];
        next_cursor: string | null;
        has_more: boolean;
        total_count: number | null;
      }>,
      ReturnType<typeof queryKeys.infiniteReadLater>,
      string | null
    >,
    "queryKey" | "queryFn" | "getNextPageParam" | "initialPageParam"
  >,
) {
  const limit = params.limit || 25;
  return useInfiniteQuery({
    queryKey: queryKeys.infiniteReadLater(),
    queryFn: ({
      pageParam,
    }: QueryFunctionContext<
      ReturnType<typeof queryKeys.infiniteReadLater>,
      string | null
    >) =>
      ApiClient.getReadLaterArticles({
        cursor: pageParam || undefined,
        limit,
      }),
    getNextPageParam: (lastPage: {
      items: ArticleSummary[];
      next_cursor: string | null;
      has_more: boolean;
      total_count: number | null;
    }) => lastPage.next_cursor,
    initialPageParam: null,
    ...options,
  });
}

export function useInfiniteTodayArticles(
  params?: { limit?: number },
  options?: Omit<
    UseInfiniteQueryOptions<
      {
        items: ArticleSummary[];
        next_cursor: string | null;
        has_more: boolean;
        total_count: number | null;
      },
      Error,
      InfiniteData<{
        items: ArticleSummary[];
        next_cursor: string | null;
        has_more: boolean;
        total_count: number | null;
      }>,
      ReturnType<typeof queryKeys.infiniteToday>,
      string | null
    >,
    "queryKey" | "queryFn" | "getNextPageParam" | "initialPageParam"
  >,
) {
  const limit = params?.limit || 25;
  return useInfiniteQuery({
    queryKey: queryKeys.infiniteToday(),
    queryFn: ({
      pageParam,
    }: QueryFunctionContext<
      ReturnType<typeof queryKeys.infiniteToday>,
      string | null
    >) =>
      ApiClient.getTodaysArticles({
        cursor: pageParam || undefined,
        limit,
      }),
    getNextPageParam: (lastPage: {
      items: ArticleSummary[];
      next_cursor: string | null;
      has_more: boolean;
      total_count: number | null;
    }) => lastPage.next_cursor,
    initialPageParam: null,
    ...options,
  });
}

export function useCheckArticleSaved(
  url: string | undefined,
  options?: Omit<
    UseQueryOptions<
      CheckArticleSavedResponse,
      Error,
      CheckArticleSavedResponse,
      ReturnType<typeof queryKeys.checkArticleSaved>
    >,
    "queryKey" | "queryFn" | "enabled"
  >,
) {
  // Always return a valid query key structure, even if empty
  const queryKey = queryKeys.checkArticleSaved(url || "");
  return useQuery({
    queryKey,
    queryFn: () => ApiClient.checkArticleSaved(url!),
    enabled: !!url,
    staleTime: 0, // Always check fresh
    ...options,
  });
}

export function useSaveArticle(
  options?: UseMutationOptions<
    SaveArticleResponse,
    unknown,
    {
      url: string;
      title?: string;
      content?: string;
      metadata?: Record<string, string>;
      priority?: string;
      note?: string;
    }
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.saveArticle(),
    mutationFn: (data: {
      url: string;
      title?: string;
      content?: string;
      metadata?: Record<string, string>;
      priority?: string;
      note?: string;
    }) => ApiClient.saveArticle(data),
    onSettled: async (_article, _error, variables) => {
      // Invalidate check query
      await queryClient.invalidateQueries({
        queryKey: queryKeys.checkArticleSaved(variables.url),
      });

      // Invalidate read later lists
      queryClient.invalidateQueries({
        queryKey: queryKeys.infiniteReadLater(),
      });
    },
    ...options,
  });
}

export function useUnsaveArticle(
  options?: UseMutationOptions<
    void,
    unknown,
    { articleId: string; url: string }
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.unsaveArticle(),
    mutationFn: ({ articleId }: { articleId: string; url: string }) => {
      return ApiClient.updateArticle(articleId, { is_saved: false }).then(
        () => undefined,
      );
    },
    onSettled: async (_data, _error, variables) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.checkArticleSaved(variables.url),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.infiniteReadLater(),
      });
    },
    ...options,
  });
}

/**
 * Hook for extracting full text content from article URL
 */
export function useExtractFullText(articleId: string, articleUrl?: string) {
  const isValidArticleId =
    articleId && articleId !== "skip" && articleId.length > 0;

  const urlHash = articleUrl ? createContentHash(articleUrl) : "no-url";

  return useQuery({
    queryKey: queryKeys.extractedContent(articleId, urlHash),
    queryFn: async (): Promise<ExtractFullTextResponse> => {
      if (!isValidArticleId) {
        throw new Error("Invalid article ID");
      }
      return ApiClient.extractFullText(articleId);
    },
    enabled: false, // Only run when manually triggered
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });
}

/**
 * Hook for generating AI summaries of articles
 */
export function useSummarizeArticle(articleId: string, content?: string) {
  const isValidArticleId =
    articleId && articleId !== "skip" && articleId.length > 0;

  const contentHash = content ? createContentHash(content) : "original";

  return useQuery({
    queryKey: queryKeys.summary(articleId, contentHash),
    queryFn: async (): Promise<SummarizeResponse> => {
      if (!isValidArticleId) {
        throw new Error("Invalid article ID");
      }
      const requestBody: SummarizeRequest = content ? { content } : {};
      return ApiClient.summarize(articleId, requestBody);
    },
    enabled: false, // Only run when manually triggered
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });
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
      return ApiClient.translate(articleId, requestBody);
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}
