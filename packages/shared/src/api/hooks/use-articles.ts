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
  > & { articleType?: string },
) {
  const { articleType, ...queryOptions } = options || {};
  return useQuery({
    queryKey: queryKeys.article(articleId),
    queryFn: () => ApiClient.getArticle(articleId, articleType),
    enabled: !!articleId,
    ...queryOptions,
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
      articleType?: string;
    },
    {
      previousArticle: Article | undefined;
      previousUnreadCounts: ArticleCountsResponse | undefined;
    }
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.updateArticle(),
    mutationFn: async ({
      articleId,
      data,
      articleType,
    }: {
      articleId: string;
      data: {
        is_read?: boolean;
        is_saved?: boolean;
        priority?: string;
        note?: string | null;
      };
      articleType?: string;
    }): Promise<void> => {
      // Map frontend fields to backend fields
      const updateData: any = { ...data };

      // Handle field mapping
      if (data.note !== undefined) {
        updateData.user_note = data.note;
        delete updateData.note;
      }

      await ApiClient.updateArticle(articleId, updateData, articleType);
    },
    onMutate: async ({ articleId, data }) => {
      // Cancel any outgoing refetches to avoid race conditions
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.article(articleId) }),
        queryClient.cancelQueries({ queryKey: [RSS_QUERY_KEYS.ARTICLES] }),
        queryClient.cancelQueries({ queryKey: queryKeys.unreadCounts() }),
        queryClient.cancelQueries({ queryKey: queryKeys.infiniteReadLater() }),
      ]);

      // Snapshot the previous values
      const previousArticle = queryClient.getQueryData<Article>(
        queryKeys.article(articleId),
      );
      const previousUnreadCounts = queryClient.getQueryData<ArticleCountsResponse>(
        queryKeys.unreadCounts(),
      );

      // Optimistically update article detail
      queryClient.setQueryData<Article>(
        queryKeys.article(articleId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            ...data,
            // Map frontend fields to backend fields for the optimistic update
            ...(data.note !== undefined && { user_note: data.note }),
            // Ensure priority is of correct type if provided
            ...(data.priority && { priority: data.priority as any }),
          };
        }
      );

      // Optimistically update all infinite lists (generic update)
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
                  }
                  : item,
              ),
            })),
          };
        },
      );

      // Specific handling for Read Later list: Remove item if unsaving
      if (data.is_saved === false) {
        queryClient.setQueriesData(
          { queryKey: queryKeys.infiniteReadLater() },
          (oldData: any) => {
            if (!oldData?.pages) return oldData;
            return {
              ...oldData,
              pages: oldData.pages.map((page: any) => ({
                ...page,
                items: page.items.filter((item: ArticleSummary) => item.id !== articleId),
              })),
            };
          },
        );
      }

      // Optimistically update unread counts
      queryClient.setQueryData<ArticleCountsResponse>(
        queryKeys.unreadCounts(),
        (old) => {
          if (!old) return old;

          const newFeedCounts = { ...old.feed_counts };
          let newReadLater = old.read_later;

          // Handle is_read changes
          if (data.is_read !== undefined) {
            // We need the feedId to update specific feed counts
            // If we don't have previousArticle (e.g. from list view without detail),
            // we can't reliably update the specific feed count, so we skip it.
            const feedId = previousArticle?.feed_id;

            if (feedId && newFeedCounts[feedId] !== undefined) {
              if (data.is_read === true && (!previousArticle || !previousArticle.is_read)) {
                newFeedCounts[feedId] = Math.max(0, newFeedCounts[feedId] - 1);
              } else if (data.is_read === false && (!previousArticle || previousArticle.is_read)) {
                newFeedCounts[feedId] = newFeedCounts[feedId] + 1;
              }
            }
          }

          // Handle is_saved changes
          if (data.is_saved !== undefined) {
            if (data.is_saved === true && (!previousArticle || !previousArticle.is_saved)) {
              newReadLater++;
            } else if (data.is_saved === false && (!previousArticle || previousArticle.is_saved)) {
              newReadLater = Math.max(0, newReadLater - 1);
            }
          }

          return {
            ...old,
            feed_counts: newFeedCounts,
            read_later: newReadLater,
          };
        },
      );

      return { previousArticle, previousUnreadCounts };
    },
    onError: (_err, { articleId }, context) => {
      // Rollback
      if (context?.previousArticle) {
        queryClient.setQueryData(
          queryKeys.article(articleId),
          context.previousArticle,
        );
      }
      if (context?.previousUnreadCounts) {
        queryClient.setQueryData(
          queryKeys.unreadCounts(),
          context.previousUnreadCounts,
        );
      }

      // Invalidate to be safe
      queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.ARTICLES] });
      queryClient.invalidateQueries({ queryKey: queryKeys.unreadCounts() });
      queryClient.invalidateQueries({ queryKey: queryKeys.infiniteReadLater() });
    },
    onSettled: (_data, _error, { articleId }) => {
      // Invalidate article
      queryClient.invalidateQueries({
        queryKey: queryKeys.article(articleId),
      });

      // Explicitly invalidate read later list
      queryClient.invalidateQueries({
        queryKey: queryKeys.infiniteReadLater(),
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
  articleType?: string,
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
      return ApiClient.translate(articleId, requestBody, articleType);
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 0,
  });
}

/**
 * Mutation hook for extracting full text
 */
export function useExtractFullTextMutation(
  options?: UseMutationOptions<
    ExtractFullTextResponse,
    unknown,
    { articleId: string; articleUrl: string; articleType?: string }
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      articleId,
      articleUrl,
      articleType,
    }: {
      articleId: string;
      articleUrl: string;
      articleType?: string;
    }) => {
      const urlHash = createContentHash(articleUrl);
      return await queryClient.fetchQuery({
        queryKey: queryKeys.extractedContent(articleId, urlHash),
        queryFn: () => ApiClient.extractFullText(articleId, articleType),
        staleTime: 30 * 60 * 1000,
        gcTime: 60 * 60 * 1000,
        retry: 0,
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
    { articleId: string; content?: string; languageKey?: string; articleType?: string }
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      articleId,
      content,
      languageKey = "original",
      articleType,
    }: {
      articleId: string;
      content?: string;
      languageKey?: string;
      articleType?: string;
    }) => {
      return await queryClient.fetchQuery({
        queryKey: queryKeys.summary(articleId, languageKey),
        queryFn: () => {
          const requestBody: SummarizeRequest = {
            ...(content && { content }),
            language_key: languageKey,
          };
          return ApiClient.summarize(articleId, requestBody, articleType);
        },
        staleTime: 30 * 60 * 1000,
        gcTime: 60 * 60 * 1000,
        retry: 0,
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
    { articleId: string; targetLanguage: string; content?: string; articleType?: string }
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      articleId,
      targetLanguage,
      content,
      articleType,
    }: {
      articleId: string;
      targetLanguage: string;
      content?: string;
      articleType?: string;
    }) => {
      return await fetchTranslation(
        queryClient,
        articleId,
        targetLanguage,
        content,
        articleType,
      );
    },
    ...options,
  });
}
