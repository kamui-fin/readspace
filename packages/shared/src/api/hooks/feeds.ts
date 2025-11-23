import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryFunctionContext,
  type UseInfiniteQueryOptions,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { ApiClient } from "../client";
import { RSS_QUERY_KEYS } from "../query-keys";
import type {
  Article,
  CheckArticleSavedResponse,
  CursorPaginatedResponse,
  Feed,
  FeedUnreadCounts,
  Folder,
  ImportTaskStatus,
  OPMLImportResponse,
  PaginatedResponse,
  SaveArticleResponse,
  Subscription,
  UnreadCounts
} from "../types";

// Configuration interface for platform-specific callbacks
export interface FeedHooksConfig {
  // Toast/notification callbacks
  showSuccess?: (message: string) => void;
  showError?: (message: string) => void;

  // Platform-specific delays
  deletionDelay?: number;
  refreshDelay?: number;
}

// Default configuration
const defaultConfig: FeedHooksConfig = {
  showSuccess: () => { }, // No-op by default
  showError: () => { }, // No-op by default
  deletionDelay: 150,
  refreshDelay: 200,
};

// Hook factory function
function createFeedHooks(userConfig: FeedHooksConfig = {}) {
  const config = { ...defaultConfig, ...userConfig };

  // OPML Import hooks
  function useImportOPML(
    options?: UseMutationOptions<OPMLImportResponse, unknown, FormData>,
  ) {
    return useMutation({
      mutationFn: (formData: FormData) =>
        ApiClient.rss.importOPML(formData) as Promise<OPMLImportResponse>,
      onSuccess: () => {
        // All imports are background now - queries will be invalidated when task completes
        // No immediate invalidation needed
      },
      ...options,
    });
  }

  function useImportTaskStatus(
    taskId: string | null,
    enabled: boolean = true,
    options?: Omit<
      UseQueryOptions<
        ImportTaskStatus,
        Error,
        ImportTaskStatus,
        [string, string | null]
      >,
      "queryKey" | "queryFn"
    >,
  ) {
    return useQuery({
      queryKey: [RSS_QUERY_KEYS.OPML_IMPORT_STATUS, taskId],
      queryFn: () =>
        ApiClient.rss.getImportTaskStatus(taskId!) as Promise<ImportTaskStatus>,
      enabled: !!taskId && enabled,
      refetchInterval: 3000, // Poll every 3 seconds
      retry: false, // Don't retry failed status checks
      ...options,
    });
  }

  // Folder hooks
  function useFolders(
    options?: Omit<
      UseQueryOptions<Folder[], Error, Folder[], [string]>,
      "queryKey" | "queryFn"
    >,
  ) {
    return useQuery({
      queryKey: [RSS_QUERY_KEYS.FOLDERS],
      queryFn: () => ApiClient.rss.getFolders() as Promise<Folder[]>,
      ...options,
    });
  }

  function useCreateFolder(
    options?: UseMutationOptions<
      Folder,
      unknown,
      { name: string },
      { previousFolders: Folder[] | undefined }
    >,
  ) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (folder: { name: string }) =>
        ApiClient.rss.createFolder(folder),
      onMutate: async () => {
        // Cancel any outgoing refetches
        await queryClient.cancelQueries({
          queryKey: [RSS_QUERY_KEYS.FOLDERS],
        });

        // Snapshot the previous value
        const previousFolders = queryClient.getQueryData<Folder[]>([
          RSS_QUERY_KEYS.FOLDERS,
        ]);

        // Don't do optimistic updates for folders to avoid "not found" errors
        // The UI will update when the server responds

        // Return a context object with the snapshotted value
        return { previousFolders };
      },
      onError: (_, __, context) => {
        // If the mutation fails, use the context returned from onMutate to roll back
        if (context?.previousFolders) {
          queryClient.setQueryData(
            [RSS_QUERY_KEYS.FOLDERS],
            context.previousFolders,
          );
        }
        config.showError?.("Failed to create folder");
      },
      onSuccess: () => {
        config.showSuccess?.("Folder created successfully");
      },
      onSettled: () => {
        // Only invalidate specific queries, don't remove cache to avoid skeleton reloading
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.FOLDERS],
        });
      },
      ...options,
    });
  }

  function useUpdateFolder(
    options?: UseMutationOptions<
      Folder,
      unknown,
      { folderId: string; name: string },
      {
        previousFolders: Folder[] | undefined;
        folderId: string;
        name: string;
      }
    >,
  ) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: ({ folderId, name }: { folderId: string; name: string }) =>
        ApiClient.rss.updateFolder(folderId, { name }),
      onMutate: async ({ folderId, name }) => {
        // Cancel any outgoing refetches to prevent conflicts
        await queryClient.cancelQueries({
          queryKey: [RSS_QUERY_KEYS.FOLDERS],
        });

        // Snapshot the previous values
        const previousFolders = queryClient.getQueryData<Folder[]>([
          RSS_QUERY_KEYS.FOLDERS,
        ]);

        // Optimistically update the folder name in folders cache
        queryClient.setQueryData(
          [RSS_QUERY_KEYS.FOLDERS],
          (old: Folder[] | undefined) => {
            if (!old) return old;
            return old.map((folder: Folder) =>
              folder.id === folderId ? { ...folder, name } : folder,
            );
          },
        );

        return { previousFolders, folderId, name };
      },
      onError: (_, __, context) => {
        // Rollback on error
        if (context?.previousFolders) {
          queryClient.setQueryData(
            [RSS_QUERY_KEYS.FOLDERS],
            context.previousFolders,
          );
        }
        config.showError?.("Failed to rename folder");
      },
      onSuccess: () => {
        config.showSuccess?.("Folder renamed successfully");
      },
      ...options,
    });
  }

  function useDeleteFolder(
    options?: UseMutationOptions<
      void,
      unknown,
      string,
      {
        previousFolders: Folder[] | undefined;
        previousFeeds: Feed[] | undefined;
        folderId: string;
      }
    >,
  ) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (folderId: string) => {
        // Add a small delay for more natural feel
        await new Promise((resolve) =>
          setTimeout(resolve, config.deletionDelay),
        );
        const response = await ApiClient.rss.deleteFolder(folderId);
        return response;
      },
      onMutate: async (folderId) => {
        // Cancel any outgoing refetches to prevent conflicts
        await queryClient.cancelQueries({
          queryKey: [RSS_QUERY_KEYS.FOLDERS],
        });
        await queryClient.cancelQueries({
          queryKey: [RSS_QUERY_KEYS.FEEDS],
        });

        // Snapshot the previous values
        const previousFolders = queryClient.getQueryData<Folder[]>([
          RSS_QUERY_KEYS.FOLDERS,
        ]);
        const previousFeeds = queryClient.getQueryData<Feed[]>([
          RSS_QUERY_KEYS.FEEDS,
        ]);

        // Optimistically remove the folder from all caches
        queryClient.setQueryData(
          [RSS_QUERY_KEYS.FOLDERS],
          (old: Folder[] | undefined) => {
            if (!old) return [];
            return old.filter((folder: Folder) => folder.id !== folderId);
          },
        );

        // Remove feeds from the folder from feeds cache
        queryClient.setQueryData(
          [RSS_QUERY_KEYS.FEEDS],
          (old: Feed[] | undefined) => {
            if (!old) return [];
            return old.filter((feed: Feed) => feed.folder_id !== folderId);
          },
        );

        return {
          previousFolders,
          previousFeeds,
          folderId,
        };
      },
      onError: (_, __, context) => {
        // Rollback on error
        if (context?.previousFolders) {
          queryClient.setQueryData(
            [RSS_QUERY_KEYS.FOLDERS],
            context.previousFolders,
          );
        }
        if (context?.previousFeeds) {
          queryClient.setQueryData(
            [RSS_QUERY_KEYS.FEEDS],
            context.previousFeeds,
          );
        }
        config.showError?.("Failed to delete folder");
      },
      onSuccess: () => {
        config.showSuccess?.("Folder deleted successfully");
      },
      onSettled: () => {
        // Invalidate unread counts to ensure they're refreshed
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
        });
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.FEED_UNREAD_COUNTS],
        });
        // Invalidate articles to refetch current view
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.ARTICLES],
        });
        // Invalidate folders to ensure sidebar updates
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.FOLDERS],
        });
        // Invalidate feeds to ensure sidebar updates
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.FEEDS],
        });
      },
      ...options,
    });
  }

  // Feed hooks
  function useFeeds(
    params?: {
      folderId?: string;
      tagNames?: string[];
      isFavorite?: boolean;
      searchQuery?: string;
    },
    options?: Omit<
      UseQueryOptions<Feed[], Error, Feed[], [string, typeof params]>,
      "queryKey" | "queryFn"
    >,
  ) {
    return useQuery({
      queryKey: [RSS_QUERY_KEYS.FEEDS, params],
      queryFn: () =>
        ApiClient.rss.getFeeds({
          folder_id: params?.folderId,
        }) as Promise<Feed[]>,
      ...options,
    });
  }

  function useFeed(
    feedId: string,
    options?: Omit<
      UseQueryOptions<Feed, Error, Feed, [string, string]>,
      "queryKey" | "queryFn"
    >,
  ) {
    return useQuery({
      queryKey: [RSS_QUERY_KEYS.FEEDS, feedId],
      queryFn: () => ApiClient.rss.getFeed(feedId),
      enabled: !!feedId,
      ...options,
    });
  }

  function useCreateFeed(
    options?: UseMutationOptions<
      Subscription,
      unknown,
      {
        url: string;
        folder_id?: string;
        silent?: boolean;
      },
      { previousFeeds: Feed[] | undefined }
    >,
  ) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (feed: {
        url: string;
        folder_id?: string;
        silent?: boolean;
      }) => ApiClient.rss.createFeed(feed),
      onMutate: async () => {
        // Cancel any outgoing refetches
        await queryClient.cancelQueries({
          queryKey: [RSS_QUERY_KEYS.FEEDS],
        });

        // Snapshot the previous value
        const previousFeeds = queryClient.getQueryData<Feed[]>([
          RSS_QUERY_KEYS.FEEDS,
        ]);

        // Don't do optimistic updates for feeds to avoid issues with fast clicking
        // The UI will update when the server responds

        // Return a context object with the snapshotted value
        return { previousFeeds };
      },
      onError: (_, __, context) => {
        // If the mutation fails, use the context returned from onMutate to roll back
        if (context?.previousFeeds) {
          queryClient.setQueryData(
            [RSS_QUERY_KEYS.FEEDS],
            context.previousFeeds,
          );
        }
        // Error toast is handled elsewhere - keep it configurable
      },
      onSuccess: () => {
        // Success toast is handled by the component or can be configured
      },
      onSettled: (data) => {
        // Only invalidate specific queries, don't remove cache to avoid skeleton reloading
        queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS] });
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.ARTICLES],
        });
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
        });
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.SIDEBAR_DATA],
        });
        // Invalidate the specific feed cache to update the feed preview screen
        // Use feed_id from the subscription response
        if (data?.feed_id) {
          queryClient.invalidateQueries({
            queryKey: [RSS_QUERY_KEYS.FEEDS, data.feed_id],
          });
        }
      },
      ...options,
    });
  }

  function useUpdateFeed(
    options?: UseMutationOptions<
      Feed,
      unknown,
      {
        feedId: string;
        data: {
          folder_id?: string;
          is_favorite?: boolean;
          title?: string;
        };
        silent?: boolean;
      },
      {
        previousFeeds: Feed[] | undefined;
        previousFeed: Feed | undefined;
        previousUnreadCounts: UnreadCounts | undefined;
        feedId: string;
        data: {
          folder_id?: string;
          is_favorite?: boolean;
          title?: string;
        };
      }
    >,
  ) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: ({
        feedId,
        data,
      }: {
        feedId: string;
        data: {
          folder_id?: string;
          is_favorite?: boolean;
          title?: string;
        };
        silent?: boolean;
      }) => ApiClient.rss.updateFeed(feedId, data),
      onMutate: async ({ feedId, data }) => {
        // Cancel any outgoing refetches to prevent conflicts
        await queryClient.cancelQueries({
          queryKey: [RSS_QUERY_KEYS.FEEDS],
        });
        await queryClient.cancelQueries({
          queryKey: [RSS_QUERY_KEYS.FEEDS, feedId],
        });
        await queryClient.cancelQueries({
          queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
        });

        // Snapshot the previous values
        const previousFeeds = queryClient.getQueryData<Feed[]>([
          RSS_QUERY_KEYS.FEEDS,
        ]);
        const previousFeed = queryClient.getQueryData<Feed>([
          RSS_QUERY_KEYS.FEEDS,
          feedId,
        ]);
        const previousUnreadCounts = queryClient.getQueryData<UnreadCounts>([
          RSS_QUERY_KEYS.UNREAD_COUNTS,
        ]);

        // Optimistically update the feed in feeds cache
        queryClient.setQueryData(
          [RSS_QUERY_KEYS.FEEDS],
          (old: Feed[] | undefined) => {
            if (!old) return old;
            return old.map((feed: Feed) =>
              feed.id === feedId ? { ...feed, ...data } : feed,
            );
          },
        );

        // Optimistically update individual feed cache
        queryClient.setQueryData(
          [RSS_QUERY_KEYS.FEEDS, feedId],
          (old: Feed | undefined) => {
            if (!old) return old;
            return { ...old, ...data };
          },
        );

        return {
          previousFeeds,
          previousFeed,
          previousUnreadCounts,
          feedId,
          data,
        };
      },
      onError: (_, __, context) => {
        // Rollback on error
        if (context?.previousFeeds) {
          queryClient.setQueryData(
            [RSS_QUERY_KEYS.FEEDS],
            context.previousFeeds,
          );
        }
        if (context?.previousFeed) {
          queryClient.setQueryData(
            [RSS_QUERY_KEYS.FEEDS, context.feedId],
            context.previousFeed,
          );
        }
        if (context?.previousUnreadCounts) {
          queryClient.setQueryData(
            [RSS_QUERY_KEYS.UNREAD_COUNTS],
            context.previousUnreadCounts,
          );
        }
        config.showError?.("Failed to update feed");
      },
      onSuccess: (_, { data, silent }) => {
        if (!silent) {
          if (data.title) {
            config.showSuccess?.("Feed renamed successfully");
          } else {
            config.showSuccess?.("Feed updated successfully");
          }
        }
      },
      onSettled: () => {
        // Invalidate all relevant queries to ensure sidebar and manage page stay in sync
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.FEEDS],
        });
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.FOLDERS],
        });
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
        });
      },
      ...options,
    });
  }

  function useRefreshFeed(
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
      // Add mutationKey for deduplication and caching
      mutationKey: ["refreshFeed"],
      mutationFn: async ({
        feedId,
        forceRefetch = false,
      }: {
        feedId: string;
        forceRefetch?: boolean;
      }) => {
        await ApiClient.rss.refreshFeed(feedId, forceRefetch);
      },
      // Cache successful refreshes for 5 minutes to prevent duplicate calls
      gcTime: 5 * 60 * 1000,
      onSuccess: (_, { feedId }) => {
        config.showSuccess?.(
          `Feed '${feedId.substring(0, 8)}...' refresh initiated.`,
        );
        queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS] });
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.FEEDS, feedId],
        });
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.ARTICLES],
        });
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
        });
      },
      onError: (error: unknown, { feedId }) => {
        const errorMessage =
          (error as { response?: { data?: { detail?: string } } })?.response
            ?.data?.detail ||
          `Failed to refresh feed '${feedId.substring(0, 8)}...'.`;
        config.showError?.(errorMessage);
      },
      ...options,
    });
  }


  function useRefreshAllFeeds(
    options?: UseMutationOptions<unknown, unknown, void>,
  ) {
    return useMutation({
      mutationFn: () => ApiClient.rss.refreshAllFeeds(),
      onSuccess: (data) => {
        config.showSuccess?.(
          "All feeds refresh started! Check status for progress.",
        );
        return data;
      },
      onError: (error: unknown) => {
        const errorMessage =
          (error as { response?: { data?: { detail?: string } } })?.response
            ?.data?.detail || "Failed to start all feeds refresh.";
        config.showError?.(errorMessage);
      },
      ...options,
    });
  }

  function useRefreshStatus(
    taskId: string | null,
    enabled: boolean = true,
    options?: Omit<
      UseQueryOptions<unknown, Error, unknown, [string, string | null]>,
      "queryKey" | "queryFn"
    >,
  ) {
    return useQuery({
      queryKey: [RSS_QUERY_KEYS.REFRESH_STATUS, taskId],
      queryFn: () =>
        ApiClient.rss.getRefreshStatus(taskId!) as Promise<unknown>,
      enabled: enabled && !!taskId,
      refetchInterval: 2000, // Poll every 2 seconds
      refetchIntervalInBackground: false,
      ...options,
    });
  }

  function useAdminDeleteFeed(
    options?: UseMutationOptions<
      { feedId: string; silent: boolean },
      unknown,
      {
        feedId: string;
        silent?: boolean;
      },
      {
        previousFeeds: Feed[] | undefined;
        feedId: string;
      }
    >,
  ) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async ({
        feedId,
        silent = false,
      }: {
        feedId: string;
        silent?: boolean;
      }) => {
        // Add a small delay for more natural feel
        await new Promise((resolve) =>
          setTimeout(resolve, config.deletionDelay),
        );
        await ApiClient.rss.adminDeleteFeed(feedId);
        return { feedId, silent };
      },
      onMutate: async ({ feedId }) => {
        // Cancel any outgoing refetches to prevent conflicts
        await queryClient.cancelQueries({
          queryKey: [RSS_QUERY_KEYS.FEEDS],
        });

        // Snapshot the previous values
        const previousFeeds = queryClient.getQueryData<Feed[]>([
          RSS_QUERY_KEYS.FEEDS,
        ]);

        // Optimistically remove the feed from feeds list
        queryClient.setQueryData(
          [RSS_QUERY_KEYS.FEEDS],
          (old: Feed[] | undefined) => {
            if (!old) return [];
            return old.filter((feed: Feed) => feed.id !== feedId);
          },
        );

        return { previousFeeds, feedId };
      },
      onError: (_, { silent }, context) => {
        // Rollback on error
        if (context?.previousFeeds) {
          queryClient.setQueryData(
            [RSS_QUERY_KEYS.FEEDS],
            context.previousFeeds,
          );
        }
        if (!silent) {
          config.showError?.("Failed to delete feed globally");
        }
      },
      onSuccess: (_, { silent }) => {
        if (!silent) {
          config.showSuccess?.("Feed deleted globally");
        }
      },
      onSettled: (data) => {
        // Invalidate unread counts to ensure they're refreshed
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
        });
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.FEED_UNREAD_COUNTS],
        });
        // Invalidate articles to refetch current view
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.ARTICLES],
        });
        // Invalidate sidebar data to ensure instant updates
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.FEEDS],
        });
        // Invalidate the specific feed cache to update the feed preview screen
        if (data?.feedId) {
          queryClient.invalidateQueries({
            queryKey: [RSS_QUERY_KEYS.FEEDS, data.feedId],
          });
        }
      },
      ...options,
    });
  }

  function useDeleteFeed(
    options?: UseMutationOptions<
      { feedId: string; silent: boolean },
      unknown,
      {
        feedId: string;
        silent?: boolean;
      },
      {
        previousFeeds: Feed[] | undefined;
        feedId: string;
      }
    >,
  ) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async ({
        feedId,
        silent = false,
      }: {
        feedId: string;
        silent?: boolean;
      }) => {
        // Add a small delay for more natural feel
        await new Promise((resolve) =>
          setTimeout(resolve, config.deletionDelay),
        );
        await ApiClient.rss.deleteFeed(feedId);
        return { feedId, silent };
      },
      onMutate: async ({ feedId }) => {
        // Cancel any outgoing refetches to prevent conflicts
        await queryClient.cancelQueries({
          queryKey: [RSS_QUERY_KEYS.FEEDS],
        });

        // Snapshot the previous values
        const previousFeeds = queryClient.getQueryData<Feed[]>([
          RSS_QUERY_KEYS.FEEDS,
        ]);

        // Optimistically remove the feed from feeds list
        queryClient.setQueryData(
          [RSS_QUERY_KEYS.FEEDS],
          (old: Feed[] | undefined) => {
            if (!old) return [];
            return old.filter((feed: Feed) => feed.id !== feedId);
          },
        );

        return { previousFeeds, feedId };
      },
      onError: (_, { silent }, context) => {
        // Rollback on error
        if (context?.previousFeeds) {
          queryClient.setQueryData(
            [RSS_QUERY_KEYS.FEEDS],
            context.previousFeeds,
          );
        }
        if (!silent) {
          config.showError?.("Failed to remove feed");
        }
      },
      onSuccess: (_, { silent }) => {
        if (!silent) {
          config.showSuccess?.("Feed removed successfully");
        }
      },
      onSettled: (data) => {
        // Invalidate unread counts to ensure they're refreshed
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
        });
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.FEED_UNREAD_COUNTS],
        });
        // Invalidate articles to refetch current view
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.ARTICLES],
        });
        // Invalidate sidebar data to ensure instant updates
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.FEEDS],
        });
        // Invalidate the specific feed cache to update the feed preview screen
        if (data?.feedId) {
          queryClient.invalidateQueries({
            queryKey: [RSS_QUERY_KEYS.FEEDS, data.feedId],
          });
        }
      },
      ...options,
    });
  }

  function useBulkDeleteFeeds(
    options?: UseMutationOptions<
      { deleted_count: number; deleted_ids: string[] },
      unknown,
      { feedIds: string[] },
      {
        previousFeeds: Feed[] | undefined;
      }
    >,
  ) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: ({ feedIds }: { feedIds: string[] }) =>
        ApiClient.rss.bulkDeleteFeeds(feedIds),
      onMutate: async ({ feedIds }) => {
        // Cancel any outgoing refetches
        await queryClient.cancelQueries({
          queryKey: [RSS_QUERY_KEYS.FEEDS],
        });

        // Snapshot previous values
        const previousFeeds = queryClient.getQueryData<Feed[]>([
          RSS_QUERY_KEYS.FEEDS,
        ]);

        // Optimistically remove feeds
        queryClient.setQueryData(
          [RSS_QUERY_KEYS.FEEDS],
          (old: Feed[] | undefined) => {
            if (!old) return [];
            return old.filter((feed: Feed) => !feedIds.includes(feed.id));
          },
        );

        return { previousFeeds };
      },
      onError: (_, __, context) => {
        // Rollback on error
        if (context?.previousFeeds) {
          queryClient.setQueryData(
            [RSS_QUERY_KEYS.FEEDS],
            context.previousFeeds,
          );
        }
        config.showError?.("Failed to delete feeds");
      },
      onSuccess: (data) => {
        config.showSuccess?.(
          `Deleted ${data.deleted_count} feed${data.deleted_count > 1 ? "s" : ""}`,
        );
      },
      onSettled: () => {
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.FEEDS],
        });
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
        });
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.FEED_UNREAD_COUNTS],
        });
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.ARTICLES],
        });
      },
      ...options,
    });
  }

  function useBulkUpdateFeedsFolder(
    options?: UseMutationOptions<
      {
        updated_count: number;
        updated_ids: string[];
        folder_id: string;
      },
      unknown,
      { feedIds: string[]; folderId: string },
      {
        previousFeeds: Feed[] | undefined;
      }
    >,
  ) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: ({
        feedIds,
        folderId,
      }: {
        feedIds: string[];
        folderId: string;
      }) => ApiClient.rss.bulkUpdateFeedsFolder(feedIds, folderId),
      onMutate: async ({ feedIds, folderId }) => {
        // Cancel any outgoing refetches
        await queryClient.cancelQueries({
          queryKey: [RSS_QUERY_KEYS.FEEDS],
        });

        // Snapshot previous values
        const previousFeeds = queryClient.getQueryData<Feed[]>([
          RSS_QUERY_KEYS.FEEDS,
        ]);

        // Optimistically update feeds folder
        queryClient.setQueryData(
          [RSS_QUERY_KEYS.FEEDS],
          (old: Feed[] | undefined) => {
            if (!old) return [];
            return old.map((feed: Feed) =>
              feedIds.includes(feed.id)
                ? { ...feed, folder_id: folderId }
                : feed,
            );
          },
        );

        return { previousFeeds };
      },
      onError: (_, __, context) => {
        // Rollback on error
        if (context?.previousFeeds) {
          queryClient.setQueryData(
            [RSS_QUERY_KEYS.FEEDS],
            context.previousFeeds,
          );
        }
        config.showError?.("Failed to move feeds");
      },
      onSuccess: (data) => {
        config.showSuccess?.(
          `Moved ${data.updated_count} feed${data.updated_count > 1 ? "s" : ""} to folder`,
        );
      },
      onSettled: () => {
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.FEEDS],
        });
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
        });
      },
      ...options,
    });
  }

  // Article hooks
  function useArticles(
    params: {
      feedIds?: string[];
      cursor?: string;
      limit?: number;
      isRead?: boolean;
      isReadLater?: boolean;
      isFavorite?: boolean;
    },
    options?: Omit<
      UseQueryOptions<
        CursorPaginatedResponse<Article>,
        Error,
        CursorPaginatedResponse<Article>,
        [string, typeof params]
      >,
      "queryKey" | "queryFn"
    >,
  ) {
    return useQuery({
      queryKey: [RSS_QUERY_KEYS.ARTICLES, params],
      queryFn: () =>
        ApiClient.rss.getArticles({
          feed_ids: params.feedIds,
          cursor: params.cursor,
          limit: params.limit,
          is_read: params.isRead,
          is_read_later: params.isReadLater,
          is_favorite: params.isFavorite,
        }),
      ...options,
    });
  }

  function useRecentlyReadArticles(
    params: { cursor?: string; limit?: number } = {},
    options?: Omit<
      UseQueryOptions<
        CursorPaginatedResponse<Article>,
        Error,
        CursorPaginatedResponse<Article>,
        [string, string, typeof params]
      >,
      "queryKey" | "queryFn"
    >,
  ) {
    return useQuery({
      queryKey: [RSS_QUERY_KEYS.ARTICLES, "recently_read", params],
      queryFn: () =>
        ApiClient.rss.getRecentlyReadArticles(params),
      ...options,
    });
  }

  function useReadLaterArticles(
    params: { cursor?: string; limit?: number } = {},
    options?: Omit<
      UseQueryOptions<
        CursorPaginatedResponse<Article>,
        Error,
        CursorPaginatedResponse<Article>,
        [string, string, typeof params]
      >,
      "queryKey" | "queryFn"
    >,
  ) {
    return useQuery({
      queryKey: [RSS_QUERY_KEYS.ARTICLES, "read_later", params],
      queryFn: () =>
        ApiClient.rss.getReadLaterArticles(params),
      ...options,
    });
  }

  function useUnreadCounts(
    options?: Omit<
      UseQueryOptions<
        UnreadCounts,
        Error,
        UnreadCounts,
        [string]
      >,
      "queryKey" | "queryFn"
    >,
  ) {
    return useQuery({
      queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
      queryFn: () => ApiClient.rss.getUnreadCounts(),
      ...options,
    });
  }

  function useFeedUnreadCounts(
    options?: Omit<
      UseQueryOptions<
        FeedUnreadCounts,
        Error,
        FeedUnreadCounts,
        [string]
      >,
      "queryKey" | "queryFn"
    >,
  ) {
    return useQuery({
      queryKey: [RSS_QUERY_KEYS.FEED_UNREAD_COUNTS],
      queryFn: () => ApiClient.rss.getFeedUnreadCounts(),
      ...options,
    });
  }

  function useArticle(
    articleId: string,
    options?: Omit<
      UseQueryOptions<Article, Error, Article, [string, string]>,
      "queryKey" | "queryFn"
    >,
  ) {
    return useQuery({
      queryKey: [RSS_QUERY_KEYS.ARTICLE, articleId],
      queryFn: () => ApiClient.rss.getArticle(articleId) as Promise<Article>,
      enabled: !!articleId,
      ...options,
    });
  }

  function useSubscribeToFeed(
    options?: UseMutationOptions<
      void,
      unknown,
      {
        feedId: string;
        folderId: string;
      }
    >,
  ) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async ({
        feedId,
        folderId,
      }: {
        feedId: string;
        folderId: string;
      }): Promise<void> => {
        await ApiClient.rss.subscribeToFeed(feedId, { folder_id: folderId });
      },
      onSuccess: () => {
        // Invalidate all feed-related queries
        queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS] });
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
        });
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.SIDEBAR_DATA],
        });
        // Don't invalidate discover queries to prevent search reload
        // The feed cards will update their subscription status via their own useFeeds queries
      },
      onError: (error: unknown) => {
        let errorMessage = "Failed to subscribe to feed";
        const err = error as {
          message?: string;
          detail?: string;
          response?: { data?: { detail?: string; message?: string } };
        };
        if (err?.message) {
          errorMessage = err.message;
        } else if (err?.detail) {
          errorMessage = err.detail;
        } else if (typeof error === "string") {
          errorMessage = error;
        } else if (err?.response?.data?.detail) {
          errorMessage = err.response.data.detail;
        } else if (err?.response?.data?.message) {
          errorMessage = err.response.data.message;
        }
        config.showError?.(errorMessage);
      },
      ...options,
    });
  }

  function useUpdateArticle(
    options?: UseMutationOptions<
      void,
      unknown,
      {
        articleId: string;
        data: {
          is_read?: boolean;
          read_at?: string;
          is_read_later?: boolean;
          is_favorite?: boolean;
          priority?: string;
          note?: string | null;
          title?: string;
        };
        articleType?: "feed" | "clipped";
      },
      {
        previousArticle: Article | undefined;
        previousInfiniteQueries: Map<string, any>;
        previousUnreadCounts: UnreadCounts | undefined;
        previousFeeds: Feed[] | undefined;
        articleId: string;
        data: {
          is_read?: boolean;
          read_at?: string;
          is_read_later?: boolean;
          is_favorite?: boolean;
          priority?: string;
          note?: string | null;
          title?: string;
        };
      }
    >,
  ) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async ({
        articleId,
        data,
        articleType = "feed",
      }: {
        articleId: string;
        data: {
          is_read?: boolean;
          read_at?: string;
          is_read_later?: boolean;
          is_favorite?: boolean;
          priority?: string;
          note?: string | null;
          title?: string;
        };
        articleType?: "feed" | "clipped";
      }): Promise<void> => {
        await ApiClient.rss.updateArticle(articleId, data, articleType);
      },
      onMutate: async ({ articleId, data }) => {
        // Cancel any outgoing refetches to prevent conflicts
        await queryClient.cancelQueries({
          queryKey: [RSS_QUERY_KEYS.ARTICLE, articleId],
        });
        await queryClient.cancelQueries({
          queryKey: [RSS_QUERY_KEYS.ARTICLES, "infinite"],
        });
        await queryClient.cancelQueries({
          queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
        });
        await queryClient.cancelQueries({
          queryKey: [RSS_QUERY_KEYS.FEEDS],
        });

        // Snapshot the previous article data
        const previousArticle = queryClient.getQueryData<Article>([
          RSS_QUERY_KEYS.ARTICLE,
          articleId,
        ]);

        // Store previous infinite query states
        const previousInfiniteQueries = new Map();
        const queries = queryClient.getQueriesData({
          queryKey: [RSS_QUERY_KEYS.ARTICLES, "infinite"],
        });

        for (const [queryKey, queryData] of queries) {
          previousInfiniteQueries.set(JSON.stringify(queryKey), queryData);
        }

        // Snapshot unread counts and feeds for rollback
        const previousUnreadCounts = queryClient.getQueryData<UnreadCounts>([
          RSS_QUERY_KEYS.UNREAD_COUNTS,
        ]);
        const previousFeeds = queryClient.getQueryData<Feed[]>([
          RSS_QUERY_KEYS.FEEDS,
        ]);

        // Optimistically update the specific article cache
        queryClient.setQueryData(
          [RSS_QUERY_KEYS.ARTICLE, articleId],
          (old: Article | undefined) => {
            if (!old) return old;
            return { ...old, ...data };
          },
        );

        // If adding to read later, explicitly create/update the read later cache
        if (data.is_read_later && previousArticle) {
          const readLaterQueryKey = [RSS_QUERY_KEYS.ARTICLES, "infinite", "read_later"];
          queryClient.setQueryData(readLaterQueryKey, (old: any) => {
            // If no cache exists, create it with this article
            if (!old?.pages) {
              return {
                pages: [{
                  items: [{ ...previousArticle, ...data }],
                  next_cursor: null,
                  has_more: false,
                  total_count: 1,
                }],
                pageParams: [null],
              };
            }

            // Cache exists - add article if not already there
            const firstPage = old.pages[0];
            const articleExists = firstPage?.items?.some((item: Article) => item.id === articleId);

            if (!articleExists) {
              // Add to beginning of first page
              return {
                ...old,
                pages: old.pages.map((page: any, index: number) =>
                  index === 0
                    ? { ...page, items: [{ ...previousArticle, ...data }, ...page.items] }
                    : page
                ),
              };
            }

            return old;
          });
        }

        // Optimistically update articles in existing infinite queries
        const infiniteQueries = queryClient.getQueriesData({
          queryKey: [RSS_QUERY_KEYS.ARTICLES, "infinite"],
        });

        for (const [queryKey] of infiniteQueries) {
          const isReadLaterQuery = queryKey[2] === 'read_later';

          queryClient.setQueryData(queryKey, (old: any) => {
            // If no cache exists, skip update
            if (!old?.pages) return old;

            return {
              ...old,
              pages: old.pages.map((page: PaginatedResponse<Article>) => ({
                ...page,
                items: page.items
                  .map((article: Article) =>
                    article.id === articleId ? { ...article, ...data } : article,
                  )
                  .filter((article: Article) => {
                    // If we're in read_later list and unmarking read_later, remove from list
                    if (
                      isReadLaterQuery &&
                      article.id === articleId &&
                      data.is_read_later === false
                    ) {
                      return false;
                    }
                    return true;
                  }),
              })),
            };
          });
        }

        // Optimistically update unread counts and read later counts
        if (previousArticle) {
          // Check if is_read changed
          const isReadChanged = data.is_read !== undefined && previousArticle.is_read !== data.is_read;
          const readDelta = isReadChanged ? (data.is_read ? -1 : 1) : 0;

          // Check if is_read_later changed
          const isReadLaterChanged = data.is_read_later !== undefined && previousArticle.is_read_later !== data.is_read_later;
          const readLaterDelta = isReadLaterChanged ? (data.is_read_later ? 1 : -1) : 0;

          // Only update if something changed
          if (isReadChanged || isReadLaterChanged) {
            // Update ALL unread count queries
            queryClient.setQueriesData(
              { queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS] },
              (old: UnreadCounts | undefined) => {
                if (!old) return old;

                const updated = { ...old };

                // Update total unread count if is_read changed
                if (isReadChanged && updated.total_unread !== undefined) {
                  updated.total_unread = Math.max(0, updated.total_unread + readDelta);
                }

                // Update read_later_count if is_read_later changed
                if (isReadLaterChanged && updated.read_later_count !== undefined) {
                  updated.read_later_count = Math.max(0, updated.read_later_count + readLaterDelta);
                }

                return updated;
              },
            );
          }
        }

        return {
          previousArticle,
          previousInfiniteQueries,
          previousUnreadCounts,
          previousFeeds,
          articleId,
          data
        };
      },
      onError: (_, __, context) => {
        // Rollback on error
        if (context?.previousArticle) {
          queryClient.setQueryData(
            [RSS_QUERY_KEYS.ARTICLE, context.articleId],
            context.previousArticle,
          );
        }

        // Rollback infinite queries
        if (context?.previousInfiniteQueries) {
          for (const [queryKey, queryData] of context.previousInfiniteQueries.entries()) {
            queryClient.setQueryData(JSON.parse(queryKey), queryData);
          }
        }

        // Rollback unread counts
        if (context?.previousUnreadCounts) {
          queryClient.setQueryData(
            [RSS_QUERY_KEYS.UNREAD_COUNTS],
            context.previousUnreadCounts,
          );
        }

        // Rollback feeds
        if (context?.previousFeeds) {
          queryClient.setQueryData(
            [RSS_QUERY_KEYS.FEEDS],
            context.previousFeeds,
          );
        }

        config.showError?.("Failed to update article");
      },
      onSuccess: (_, { articleId }) => {
        // Invalidate queries - React Query will refetch them as needed
        // Optimistic updates already applied, so active views won't show skeleton flash
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.ARTICLE, articleId],
        });

        // Invalidate all check queries (for extension popup)
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === RSS_QUERY_KEYS.ARTICLE &&
            typeof query.queryKey[1] === 'string' &&
            query.queryKey[1].startsWith('check-'),
        });

        // Invalidate unread counts
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === RSS_QUERY_KEYS.UNREAD_COUNTS,
        });

        // Invalidate feed unread counts
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.FEED_UNREAD_COUNTS],
        });

        // Invalidate article lists
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.ARTICLES],
        });

        // Invalidate feeds
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.FEEDS],
        });
      },
      ...options,
    });
  }

  // Infinite Query Hooks
  function useInfiniteArticles(
    params: {
      feedIds?: string[];
      folderId?: string;
      limit?: number;
      isRead?: boolean;
      isReadLater?: boolean;
      isFavorite?: boolean;
    },
    options?: UseInfiniteQueryOptions<
      CursorPaginatedResponse<Article>,
      Error,
      CursorPaginatedResponse<Article>,
      [string, string, typeof params],
      string | null
    >,
  ) {
    return useInfiniteQuery({
      queryKey: [RSS_QUERY_KEYS.ARTICLES, "infinite", params],
      queryFn: ({
        pageParam,
      }: QueryFunctionContext<[string, string, typeof params], string | null>) =>
        ApiClient.rss.getArticles({
          feed_ids: params.feedIds,
          folder_id: params.folderId,
          cursor: pageParam || undefined,
          limit: params.limit || 25,
          is_read: params.isRead,
          is_read_later: params.isReadLater,
          is_favorite: params.isFavorite,
        }),
      getNextPageParam: (lastPage: CursorPaginatedResponse<Article>) => {
        // Use cursor from response
        return lastPage.next_cursor;
      },
      initialPageParam: null,
      ...options,
    });
  }

  function useInfiniteRecentlyReadArticles(
    params: { limit?: number } = {},
    options?: UseInfiniteQueryOptions<
      CursorPaginatedResponse<Article>,
      Error,
      CursorPaginatedResponse<Article>,
      [string, string, string],
      string | null
    >,
  ) {
    const limit = params.limit || 25;
    return useInfiniteQuery({
      queryKey: [RSS_QUERY_KEYS.ARTICLES, "infinite", "recently_read"],
      queryFn: ({
        pageParam,
      }: QueryFunctionContext<
        [string, string, string],
        string | null
      >) =>
        ApiClient.rss.getRecentlyReadArticles({
          cursor: pageParam || undefined,
          limit,
        }),
      getNextPageParam: (lastPage: CursorPaginatedResponse<Article>) => {
        return lastPage.next_cursor;
      },
      initialPageParam: null,
      ...options,
    });
  }

  function useInfiniteReadLaterArticles(
    params: { limit?: number } = {},
    options?: UseInfiniteQueryOptions<
      CursorPaginatedResponse<Article>,
      Error,
      CursorPaginatedResponse<Article>,
      [string, string, string],
      string | null
    >,
  ) {
    const limit = params.limit || 25;
    return useInfiniteQuery({
      queryKey: [RSS_QUERY_KEYS.ARTICLES, "infinite", "read_later"],
      queryFn: ({
        pageParam,
      }: QueryFunctionContext<
        [string, string, string],
        string | null
      >) =>
        ApiClient.rss.getReadLaterArticles({
          cursor: pageParam || undefined,
          limit,
        }),
      getNextPageParam: (lastPage: CursorPaginatedResponse<Article>) => {
        return lastPage.next_cursor;
      },
      initialPageParam: null,
      ...options,
    });
  }

  function useInfiniteTodayArticles(
    params?: { limit?: number },
    options?: UseInfiniteQueryOptions<
      CursorPaginatedResponse<Article>,
      Error,
      CursorPaginatedResponse<Article>,
      [string, string, string],
      string | null
    >,
  ) {
    const limit = params?.limit || 25;
    return useInfiniteQuery({
      queryKey: [RSS_QUERY_KEYS.ARTICLES, "infinite", "today"],
      queryFn: ({
        pageParam,
      }: QueryFunctionContext<
        [string, string, string],
        string | null
      >) =>
        ApiClient.rss.getTodaysArticles({
          cursor: pageParam || undefined,
          limit,
        }),
      getNextPageParam: (lastPage: CursorPaginatedResponse<Article>) => {
        return lastPage.next_cursor;
      },
      initialPageParam: null,
      ...options,
    });
  }

  function useCheckArticleSaved(
    url: string | undefined,
    options?: Omit<
      UseQueryOptions<CheckArticleSavedResponse, Error, CheckArticleSavedResponse, [string, string]>,
      "queryKey" | "queryFn"
    >,
  ) {
    return useQuery({
      queryKey: [RSS_QUERY_KEYS.ARTICLE, `check-${url}`],
      queryFn: () => ApiClient.rss.checkArticleSaved(url!),
      enabled: !!url,
      staleTime: 0, // Always check fresh
      ...options,
    });
  }

  function useSaveArticle(
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
      mutationFn: (data: {
        url: string;
        title?: string;
        content?: string;
        metadata?: Record<string, string>;
        priority?: string;
        note?: string;
      }) => ApiClient.rss.saveArticle(data),
      onSettled: async (_article, _error, variables) => {
        // Invalidate to refetch and show the real data
        await queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.ARTICLE, `check-${variables.url}`],
        });
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.ARTICLES, "infinite", "read_later"],
        });
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.ARTICLES, "read_later"],
        });
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.ARTICLES],
        });
      },
      onError: (error: unknown) => {
        const errorMessage =
          (error as { response?: { data?: { detail?: string } } })?.response
            ?.data?.detail || "Failed to save article";
        config.showError?.(errorMessage);
      },
      ...options,
    });
  }

  function useUnsaveArticle(
    options?: UseMutationOptions<
      void,
      unknown,
      { articleId: string; url: string }
    >,
  ) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: ({ articleId }: { articleId: string; url: string }) =>
        ApiClient.rss.updateArticle(articleId, { is_read_later: false }, 'clipped') as Promise<void>,
      onSettled: async (_data, _error, variables) => {
        // Invalidate to refetch and show the real data
        await queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.ARTICLE, `check-${variables.url}`],
        });
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.ARTICLES, "infinite", "read_later"],
        });
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.ARTICLES, "read_later"],
        });
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.ARTICLES],
        });
      },
      onError: (error: unknown) => {
        const errorMessage =
          (error as { response?: { data?: { detail?: string } } })?.response
            ?.data?.detail || "Failed to unsave article";
        config.showError?.(errorMessage);
      },
      ...options,
    });
  }

  // Return all hooks as an object
  return {
    // OPML hooks
    useImportOPML,
    useImportTaskStatus,

    // Folder hooks
    useFolders,
    useCreateFolder,
    useUpdateFolder,
    useDeleteFolder,

    // Feed hooks
    useFeeds,
    useFeed,
    useCreateFeed,
    useUpdateFeed,
    useRefreshFeed,
    useRefreshAllFeeds,
    useRefreshStatus,
    useDeleteFeed,
    useAdminDeleteFeed,
    useBulkDeleteFeeds,
    useBulkUpdateFeedsFolder,

    // Article hooks
    useArticles,
    useRecentlyReadArticles,
    useReadLaterArticles,
    useUnreadCounts,
    useFeedUnreadCounts,
    useArticle,
    useSubscribeToFeed,
    useUpdateArticle,
    useCheckArticleSaved,
    useSaveArticle,
    useUnsaveArticle,

    // Infinite query hooks
    useInfiniteArticles,
    useInfiniteRecentlyReadArticles,
    useInfiniteReadLaterArticles,
    useInfiniteTodayArticles,
  };
}

// Export individual hooks using default configuration for backward compatibility
const defaultHooks = createFeedHooks();
export const {
  // OPML hooks
  useImportOPML,
  useImportTaskStatus,

  // Folder hooks
  useFolders,
  useCreateFolder,
  useUpdateFolder,
  useDeleteFolder,

  // Feed hooks
  useFeeds,
  useFeed,
  useCreateFeed,
  useUpdateFeed,
  useRefreshFeed,
  useRefreshAllFeeds,
  useRefreshStatus,
  useDeleteFeed,
  useAdminDeleteFeed,
  useBulkDeleteFeeds,
  useBulkUpdateFeedsFolder,

  // Article hooks
  useArticles,
  useRecentlyReadArticles,
  useReadLaterArticles,
  useUnreadCounts,
  useFeedUnreadCounts,
  useArticle,
  useSubscribeToFeed,
  useUpdateArticle,
  useCheckArticleSaved,
  useSaveArticle,
  useUnsaveArticle,

  // Infinite query hooks
  useInfiniteArticles,
  useInfiniteRecentlyReadArticles,
  useInfiniteReadLaterArticles,
  useInfiniteTodayArticles,
} = defaultHooks;

// Export the factory function for custom configurations
export { createFeedHooks };
