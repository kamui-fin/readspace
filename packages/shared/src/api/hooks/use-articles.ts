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
    { previousArticle: Article | undefined }
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
    onMutate: async ({ articleId, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.article(articleId),
      });
      await queryClient.cancelQueries({
        queryKey: [RSS_QUERY_KEYS.ARTICLES],
      });
      await queryClient.cancelQueries({
        queryKey: queryKeys.unreadCounts(),
      });

      // Snapshot the previous value
      const previousArticle = queryClient.getQueryData<Article>(
        queryKeys.article(articleId),
      );

      // Optimistically update article detail
      if (previousArticle) {
        queryClient.setQueryData<Article>(queryKeys.article(articleId), {
          ...previousArticle,
          ...data,
          // Map frontend fields to backend fields for the optimistic update
          ...(data.note !== undefined && { user_note: data.note }),
          // Ensure priority is of correct type if provided
          ...(data.priority && { priority: data.priority as any }),
        });
      }

      // Optimistically update infinite lists
      queryClient.setQueriesData(
        { queryKey: [RSS_QUERY_KEYS.ARTICLES] },
        (oldData: any) => {
          if (!oldData?.pages) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page: any) => ({
              ...page,
              items: page.items.map((item: ArticleSummary) =>
                item.id === articleId
                  ? {
                    ...item,
                    ...data,
                    ...(data.priority && { priority: data.priority as any }),
                    // If marking as read, it might disappear from some lists (like unread only),
                    // but for optimistic updates, we usually just update the state.
                    // If we want to remove it, it's more complex.
                    // For now, just update the properties.
                  }
                  : item,
              ),
            })),
          };
        },
      );

      // Optimistically update unread counts
      if (data.is_read === true) {
        queryClient.setQueryData<ArticleCountsResponse>(
          queryKeys.unreadCounts(),
          (old) => {
            if (!old) return old;

            let newFeedCounts = old.feed_counts;

            // Try to update specific feed count if we know the feed ID
            if (previousArticle && !previousArticle.is_read) {
              const feedId = previousArticle.feed_id;
              if (feedId && old.feed_counts[feedId]) {
                newFeedCounts = {
                  ...old.feed_counts,
                  [feedId]: Math.max(0, old.feed_counts[feedId] - 1),
                };
              }
            }

            return {
              ...old,
              feed_counts: newFeedCounts,
              // We don't have total_unread in ArticleCountsResponse, so we don't update it.
              // If the UI relies on derived total, it will recalculate from feed_counts.
            };
          },
        );
      }

      return { previousArticle };
    },
    onError: (_err, { articleId }, context) => {
      // Rollback
      if (context?.previousArticle) {
        queryClient.setQueryData(
          queryKeys.article(articleId),
          context.previousArticle,
        );
      }
      // We can't easily rollback infinite lists perfectly without snapshots of all of them,
      // but invalidating them in onSettled will fix it eventually.
      // For now, we rely on onSettled to re-fetch.
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

/**
 * Mutation hook for extracting full text
 */
export function useExtractFullTextMutation(
  options?: UseMutationOptions<
    ExtractFullTextResponse,
    unknown,
    { articleId: string; articleUrl: string }
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      articleId,
      articleUrl,
    }: {
      articleId: string;
      articleUrl: string;
    }) => {
      const urlHash = createContentHash(articleUrl);
      return await queryClient.fetchQuery({
        queryKey: queryKeys.extractedContent(articleId, urlHash),
        queryFn: () => ApiClient.extractFullText(articleId),
        staleTime: 30 * 60 * 1000,
        gcTime: 60 * 60 * 1000,
      });
    },
    onSuccess: (data, variables) => {
      // Optimistically update the article with the extracted content
      queryClient.setQueryData<Article>(
        queryKeys.article(variables.articleId),
        (oldArticle) => {
          if (!oldArticle) return oldArticle;
          return {
            ...oldArticle,
            extracted_content: data.content,
            extracted_read_time: data.estimated_read_time_minutes,
            estimated_read_time_minutes:
              data.estimated_read_time_minutes ??
              oldArticle.estimated_read_time_minutes,
          };
        },
      );

      // Invalidate the article to pick up extracted_content field
      queryClient.invalidateQueries({
        queryKey: queryKeys.article(variables.articleId),
      });
    },
    ...options,
  });
}

/**
 * Mutation hook for summarizing articles
 */
export function useSummarizeArticleMutation(
  options?: UseMutationOptions<
    SummarizeResponse,
    unknown,
    { articleId: string; content?: string }
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      articleId,
      content,
    }: {
      articleId: string;
      content?: string;
    }) => {
      const contentHash = content ? createContentHash(content) : "original";
      return await queryClient.fetchQuery({
        queryKey: queryKeys.summary(articleId, contentHash),
        queryFn: () => {
          const requestBody: SummarizeRequest = content ? { content } : {};
          return ApiClient.summarize(articleId, requestBody);
        },
        staleTime: 30 * 60 * 1000,
        gcTime: 60 * 60 * 1000,
      });
    },
    ...options,
  });
}

/**
 * Mutation hook for translating articles
 */
export function useTranslateArticleMutation(
  options?: UseMutationOptions<
    TranslateResponse,
    unknown,
    { articleId: string; targetLanguage: string; content?: string }
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      articleId,
      targetLanguage,
      content,
    }: {
      articleId: string;
      targetLanguage: string;
      content?: string;
    }) => {
      return await fetchTranslation(
        queryClient,
        articleId,
        targetLanguage,
        content,
      );
    },
    ...options,
  });
}
