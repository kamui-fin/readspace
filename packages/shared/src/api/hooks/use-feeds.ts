import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { ApiClient } from "../client";
import { RSS_QUERY_KEYS, mutationKeys, queryKeys } from "../query-keys";
import type {
  FeedDetail,
  Subscription,
  FeedDiscoveryResult,
  FeedsResponse,
} from "../types";

export function useFeeds(
  params?: {
    folderId?: string;
    isFavorite?: boolean;
    extended?: boolean;
  },
  options?: Omit<
    UseQueryOptions<
      FeedsResponse,
      Error,
      FeedsResponse,
      ReturnType<typeof queryKeys.feeds>
    >,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: queryKeys.feeds(params),
    queryFn: () =>
      ApiClient.getFeeds({
        folder_id: params?.folderId,
        is_favorite: params?.isFavorite,
        extended: params?.extended,
      }),
    staleTime: 60000, // 1 minute
    ...options,
  });
}

export function useFeed(
  feedId: string,
  options?: Omit<
    UseQueryOptions<
      FeedDetail,
      Error,
      FeedDetail,
      ReturnType<typeof queryKeys.feed>
    >,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: queryKeys.feed(feedId),
    queryFn: () => ApiClient.getFeed(feedId),
    enabled: !!feedId,
    ...options,
  });
}

export function usePreviewFeedUrl(
  url: string,
  options?: Omit<
    UseQueryOptions<
      FeedDiscoveryResult,
      Error,
      FeedDiscoveryResult,
      ["feedPreview", string]
    >,
    "queryKey" | "queryFn"
  >,
) {
  const trimmedQuery = url.trim();
  return useQuery({
    queryKey: ["feedPreview", trimmedQuery],
    queryFn: async () => {
      const response = await ApiClient.previewFeed(trimmedQuery);
      return response;
    },
    enabled: trimmedQuery.length > 0,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

export function useCreateFeed(
  options?: UseMutationOptions<
    Subscription,
    unknown,
    {
      url: string;
      folder_id?: string;
    }
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.createFeed(),
    mutationFn: (feed: { url: string; folder_id?: string }) =>
      ApiClient.createFeed(feed),
    onSuccess: (newSubscription) => {
      // Update feeds list with new subscription across all variations
      queryClient.setQueriesData<FeedsResponse>(
        { queryKey: [RSS_QUERY_KEYS.FEEDS, "list"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            subscriptions: [...(old.subscriptions || []), newSubscription],
          };
        }
      );

      // Update the individual feed detail cache instantly if it exists
      if (newSubscription?.feed?.id) {
        queryClient.setQueriesData<FeedDetail>(
          { queryKey: queryKeys.feed(newSubscription.feed.id) },
          (old) => {
            if (!old) return old;
            return {
              ...old,
              is_subscribed: true,
            };
          }
        );
      }
    },
    onSettled: (data) => {
      queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS, "list"], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.ARTICLES], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: queryKeys.unreadCounts(), refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FOLDERS], refetchType: 'all' });

      // Invalidate specific feed cache
      if (data?.feed?.id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.feed(data.feed.id),
        });
      }
    },
    ...options,
  });
}

export function useUpdateFeed(
  options?: UseMutationOptions<
    Subscription,
    unknown,
    {
      feedId: string;
      data: {
        folder_id?: string;
        is_favorite?: boolean;
        custom_title?: string;
      };
    },
    unknown
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.updateFeed(),
    mutationFn: ({
      feedId,
      data,
    }: {
      feedId: string;
      data: {
        folder_id?: string;
        is_favorite?: boolean;
        custom_title?: string;
      };
    }) => ApiClient.updateFeed(feedId, data),
    onSuccess: (updatedSubscription, { feedId, data }) => {
      // Update feeds list cache instantly
      queryClient.setQueriesData<FeedsResponse>(
        { queryKey: [RSS_QUERY_KEYS.FEEDS, "list"] },
        (old) => {
          if (!old) return old;
          
          const updatedSubscriptions = (old.subscriptions || []).map((sub) => {
            if (sub.feed.id === feedId) {
              return {
                ...sub,
                is_favorite: data.is_favorite !== undefined ? data.is_favorite : sub.is_favorite,
                custom_title: data.custom_title !== undefined ? data.custom_title : sub.custom_title,
                folder: updatedSubscription.folder || sub.folder,
              };
            }
            return sub;
          });

          return {
            ...old,
            subscriptions: updatedSubscriptions,
          };
        },
      );

      // Update the individual feed detail cache instantly if it exists
      queryClient.setQueriesData<FeedDetail>(
        { queryKey: [RSS_QUERY_KEYS.FEEDS, "detail", feedId] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            is_favorite: data.is_favorite !== undefined ? data.is_favorite : (old as any).is_favorite,
            title: data.custom_title !== undefined ? data.custom_title : old.title,
          } as any;
        },
      );
    },
    onSettled: (_data, _error, { feedId }) => {
      queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS, "list"] });
      queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FOLDERS] });
      queryClient.invalidateQueries({ queryKey: queryKeys.feed(feedId) });
    },
    ...options,
  });
}

export function useRefreshFeed(
  options?: UseMutationOptions<
    void,
    unknown,
    {
      feedId: string;
      forceRefetch?: boolean;
    }
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.refreshFeed(),
    mutationFn: async ({
      feedId,
      forceRefetch = false,
    }: {
      feedId: string;
      forceRefetch?: boolean;
    }) => {
      await ApiClient.refreshFeed(feedId, forceRefetch);
    },
    onSuccess: (_, { feedId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feed(feedId) });
      queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.ARTICLES] });
      queryClient.invalidateQueries({ queryKey: queryKeys.unreadCounts() });
    },
    ...options,
  });
}

export function useMarkFeedAllRead(
  options?: UseMutationOptions<
    { message: string; feed_id: string },
    unknown,
    string
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.markFeedAllRead(),
    mutationFn: (feedId: string) => ApiClient.markFeedAllRead(feedId),
    onSuccess: (_, feedId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feed(feedId) });
      queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.ARTICLES] });
      queryClient.invalidateQueries({ queryKey: queryKeys.unreadCounts() });
    },
    ...options,
  });
}

export function useDeleteFeed(
  options?: UseMutationOptions<
    void,
    unknown,
    {
      feedId: string;
      silent?: boolean;
    },
    unknown
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.deleteFeed(),
    mutationFn: async ({ feedId }: { feedId: string; silent?: boolean }) => {
      await ApiClient.deleteFeed(feedId);
    },
    onSuccess: (_, { feedId }) => {
      queryClient.setQueriesData<FeedsResponse>(
        { queryKey: [RSS_QUERY_KEYS.FEEDS, "list"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            subscriptions: (old.subscriptions || []).filter(
              (s) => s.feed.id !== feedId,
            ),
          };
        },
      );

      // Update the individual feed detail cache instantly if it exists
      queryClient.setQueriesData<FeedDetail>(
        { queryKey: queryKeys.feed(feedId) },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            is_subscribed: false,
          };
        },
      );
    },
    onSettled: (_data, _error, { feedId }) => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS, "list"] });
        queryClient.invalidateQueries({ queryKey: queryKeys.unreadCounts() });
        queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.ARTICLES] });
        queryClient.invalidateQueries({ queryKey: queryKeys.feed(feedId) });
      }, 300);
    },
    ...options,
  });
}

export function useAdminDeleteFeed(
  options?: UseMutationOptions<
    void,
    unknown,
    {
      feedId: string;
      silent?: boolean;
    },
    unknown
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.adminDeleteFeed(),
    mutationFn: async ({ feedId }: { feedId: string; silent?: boolean }) => {
      await ApiClient.adminDeleteFeed(feedId);
    },
    onSettled: (_data, _error, { feedId }) => {
      queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS] });
      queryClient.invalidateQueries({ queryKey: queryKeys.unreadCounts() });
      queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.ARTICLES] });
      queryClient.invalidateQueries({ queryKey: queryKeys.feed(feedId) });
    },
    ...options,
  });
}

export function useAdminUpdateFeed(
  options?: UseMutationOptions<
    FeedDetail,
    unknown,
    {
      feedId: string;
      data: {
        title?: string;
        description?: string;
        language?: string;
        top_level_category?: string;
        url?: string;
        link?: string;
        image_url?: string;
        popularity_score?: number;
      };
    },
    unknown
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.adminUpdateFeed(),
    mutationFn: ({ feedId, data }: { feedId: string; data: any }) =>
      ApiClient.adminUpdateFeed(feedId, data),
    onSettled: (_data, _error, { feedId }) => {
      queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS] });
      queryClient.invalidateQueries({ queryKey: queryKeys.feed(feedId) });
    },
    ...options,
  });
}

export function useBulkDeleteFeeds(
  options?: UseMutationOptions<
    { deleted_count: number; deleted_ids: string[] },
    unknown,
    { feedIds: string[] },
    unknown
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.bulkDeleteFeeds(),
    mutationFn: ({ feedIds }: { feedIds: string[] }) =>
      ApiClient.bulkDeleteFeeds(feedIds),
    onSuccess: (_, { feedIds }) => {
      queryClient.setQueriesData<FeedsResponse>(
        { queryKey: [RSS_QUERY_KEYS.FEEDS, "list"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            subscriptions: (old.subscriptions || []).filter(
              (s) => !feedIds.includes(s.feed.id),
            ),
          };
        },
      );
    },
    onSettled: () => {
      setTimeout(() => {
        Promise.all([
          queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS, "list"] }),
          queryClient.invalidateQueries({ queryKey: queryKeys.unreadCounts() }),
          queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.ARTICLES] }),
        ]);
      }, 300);
    },
    ...options,
  });
}

export function useBulkUpdateFeedsFolder(
  options?: UseMutationOptions<
    {
      updated_count: number;
      updated_ids: string[];
      folder_id: string;
    },
    unknown,
    { feedIds: string[]; folderId: string },
    unknown
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.bulkUpdateFeedsFolder(),
    mutationFn: ({
      feedIds,
      folderId,
    }: {
      feedIds: string[];
      folderId: string;
    }) => ApiClient.bulkUpdateFeedsFolder(feedIds, folderId),
    onSettled: () => {
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS, "list"] }),
      ]);
    },
    ...options,
  });
}
